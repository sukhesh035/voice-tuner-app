# Sruti — Indian Classical Music Practice App

> A production-ready **Tanpura + Singing Trainer** built with Nx 21, Ionic 8, Angular 21, Capacitor 7, and a fully serverless AWS backend.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Mobile / PWA  (Ionic 8 + Angular 21 + Capacitor 7)                     │
│                                                                          │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Tanpura UI  │  │  Sing / YIN │  │  Raga Trainer│  │  Progress   │  │
│  └──────┬───────┘  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
│         │                 │                 │                  │         │
│  ┌──────▼─────────────────▼─────────────────▼──────────────────▼──────┐  │
│  │               Angular Services Layer                                │  │
│  │  AudioEngineService · TanpuraPlayerService · PitchDetectionService  │  │
│  │  TrainingEngineService · AuthService · ThemeService                 │  │
│  └────────────┬────────────────────────────────────────────────────────┘  │
│               │                                                          │
│  ┌────────────▼──────────────────────────┐                              │
│  │  Web Audio API  (44100 Hz / 128-frame) │                              │
│  │  AudioWorklet(pitch-processor)         │                              │
│  │  Additive Synthesis · Karplus-Strong   │                              │
│  └───────────────────────────────────────┘                              │
└──────────────────┬──────────────────────────────────────────────────────┘
                   │ HTTPS / JWT (AWS Amplify v6)
┌──────────────────▼──────────────────────────────────────────────────────┐
│  AWS Backend  (ap-south-1)                                               │
│                                                                          │
│  API Gateway HTTP API                                                    │
│  ├── /api/sessions   → Sessions Lambda  (Node 22, ARM64)                │
│  ├── /api/users/me   → Users Lambda                                      │
│  ├── /api/streaks    → Streaks Lambda                                    │
│  └── /api/classroom  → Classroom Lambda                                  │
│                                                                          │
│  Cognito User Pool ──► JWT Authorizer ──► Lambda                        │
│                                                                          │
│  DynamoDB (on-demand)                                                    │
│  ├── sruti-users                                                         │
│  ├── sruti-sessions   (TTL 1yr, LSI: mode-index)                        │
│  ├── sruti-streaks    (TTL 1yr)                                          │
│  ├── sruti-classroom  (TTL 24h, GSI: teacherId-index)                   │
│  └── sruti-students                                                      │
│                                                                          │
│  S3 Bucket  ──► CloudFront CDN  (audio samples)                         │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Nx Monorepo Structure

```
voice-tuner-app/
├── apps/
│   ├── mobile-app/            # Ionic + Angular PWA / Capacitor app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── pages/     # Home, Tanpura, Sing, Practice, Progress,
│   │   │   │   │              #   Guru, Settings, Profile, Auth,
│   │   │   │   │              #   Classroom, SessionReport
│   │   │   │   ├── tabs/      # Bottom navigation shell
│   │   │   │   ├── core/services/  # ThemeService
│   │   │   │   ├── app.config.ts
│   │   │   │   ├── app.routes.ts
│   │   │   │   └── app.component.ts
│   │   │   ├── assets/worklets/   # pitch-processor.worklet.js
│   │   │   ├── environments/      # environment.ts / environment.prod.ts
│   │   │   └── styles/            # main.scss + _variables, _themes,
│   │   │                          #   _components, _animations
│   │   ├── capacitor.config.ts
│   │   ├── ngsw-config.json
│   │   └── project.json
│   ├── backend-api/           # Lambda sources (TypeScript / esbuild)
│   │   └── src/
│   │       ├── handlers/      # sessions, users, streaks, classroom
│   │       └── middleware/    # auth (Cognito JWT verify)
│   └── infra/                 # AWS CDK v2
│       ├── bin/app.ts
│       ├── lib/sruti-stack.ts
│       └── cdk.json
├── libs/
│   ├── audio-engine/          # AudioContext, mic, worklet loader
│   ├── tanpura-player/        # Additive synthesis + sample playback
│   ├── pitch-detection/       # YIN algorithm, Indian note mapping
│   ├── training-engine/       # Session lifecycle, AI feedback, raga data
│   ├── auth/                  # Amplify v6 wrapper, guard, interceptor
│   └── shared-utils/          # Music math, time formatting, storage
├── tailwind.config.js
├── tsconfig.base.json
├── nx.json
└── package.json
```

---

## DynamoDB Schema

### `sruti-users`
| Attribute            | Type    | Notes                              |
|---------------------|---------|------------------------------------|
| `userId` (PK)       | String  | Cognito `sub`                     |
| `email`             | String  |                                    |
| `displayName`       | String  |                                    |
| `preferences`       | Map     | key, tempo, sensitivity, theme     |
| `stats`             | Map     | totalSessions, streak, score       |
| `favoriteRagas`     | List    | raga IDs                           |
| `createdAt`         | String  | ISO timestamp                      |

### `sruti-sessions`
| Attribute         | Type    | Notes                              |
|------------------|---------|------------------------------------|
| `pk` (PK)        | String  | `userId`                          |
| `sk` (SK)        | String  | `SESS#<ISO>#<uuid>`               |
| `mode`           | String  | `shruti` / `raga` / `free`        |
| `score`          | Number  | 0–100                             |
| `noteAccuracies` | Map     | per-note % accuracy               |
| `aiSummary`      | String  |                                   |
| `ttl`            | Number  | Unix epoch; auto-delete after 1yr |

**LSI**: `mode-index` (PK=`pk`, SK=`mode`) for filtering by practice mode.

### `sruti-streaks`
| Attribute         | Type   | Notes          |
|------------------|--------|----------------|
| `pk` (PK)        | String | `userId`       |
| `sk` (SK)        | String | `YYYY-MM-DD`   |
| `durationMinutes`| Number | total that day |
| `sessionsCount`  | Number |                |

### `sruti-classroom`
| Attribute      | Type    | Notes                       |
|---------------|---------|-----------------------------|
| `sessionCode` (PK) | String | e.g. `YAMAN-X7`       |
| `teacherId`   | String  |                             |
| `isActive`    | Boolean |                             |
| `ttl`         | Number  | Auto-delete after 24h       |

**GSI**: `teacherId-index` (PK=`teacherId`, SK=`createdAt`).

### `sruti-students`
| Attribute      | Type   | Notes               |
|---------------|--------|---------------------|
| `sessionCode` (PK) | String |                |
| `studentId` (SK)   | String | Cognito `sub`  |
| `score`       | Number |                     |
| `accuracy`    | Number |                     |
| `submitted`   | Boolean|                     |

---

## Getting Started

### Prerequisites
```bash
node >= 22
pnpm >= 10
```

### Install
```bash
pnpm install
```

### Run mobile app locally
```bash
pnpm nx serve mobile-app
# Opens at http://localhost:4200
```

### Run with live reload on device
```bash
# 1. Build
pnpm nx build mobile-app

# 2. Sync to Capacitor
pnpm nx run mobile-app:cap-sync

# 3. Open in Xcode / Android Studio
pnpm nx run mobile-app:cap-open-ios
pnpm nx run mobile-app:cap-open-android
```

---

## Building for Production

### Mobile PWA / Capacitor
```bash
pnpm nx build mobile-app --configuration=production
pnpm nx run mobile-app:cap-sync
```

### Backend Lambda
```bash
pnpm nx build backend-api
# Outputs to dist/apps/backend-api/
```

---

## AWS Deployment

### One-time bootstrap (run once per AWS account/region)
```bash
cd apps/infra
pnpm cdk bootstrap aws://<ACCOUNT_ID>/ap-south-1
```

### Deploy dev stack
```bash
pnpm nx run infra:deploy-dev
```

### Deploy production stack
```bash
pnpm nx run infra:deploy-prod
```

After deployment, the CDK outputs the following values — copy them into `environment.prod.ts`:
- `ApiUrl` → `environment.apiBaseUrl`
- `UserPoolId` → `environment.amplify.userPoolId`
- `UserPoolClientId` → `environment.amplify.userPoolClientId`
- `IdentityPoolId` → `environment.amplify.identityPoolId`
- `AudioCdnUrl` → `environment.s3.baseUrl`

---

## Audio Engine Design

```
Microphone Input
    │
    ▼
MediaStreamAudioSourceNode
    │
    ├──► AnalyserNode (fftSize 4096) ──► Level monitoring (requestAnimationFrame)
    │
    └──► AudioWorkletNode("pitch-processor")
              │  [Float32Array — 2048 samples @ 44100 Hz]
              │
              ▼
         YIN Algorithm
         ├── Difference function
         ├── Cumulative mean normalized difference (CMND)
         ├── Threshold (0.15) with local minimum search
         └── Parabolic interpolation → sub-sample frequency
              │
              ▼
         postMessage({ frequency, clarity })
              │
         Main thread: PitchDetectionService
         ├── Indian note mapping (12 semitones × 7 octaves)
         ├── Cents deviation from Sa
         └── smoothPitch$ (debounce 30ms, clarity > 0.85)
```

---

## Design System

All styles live in `apps/mobile-app/src/styles/`. No `.css` files — SCSS only.

| Token                    | Value                    |
|--------------------------|--------------------------|
| `--sruti-primary`        | `#7C4DFF` (violet)       |
| `--sruti-secondary`      | `#00E5C2` (teal)         |
| `--sruti-accent`         | `#FF6B35` (coral)        |
| `--sruti-bg-primary`     | `#0A0A1B` (near-black)   |
| `--sruti-surface`        | `#12122A`                |
| Glass card blur          | `20px`                   |
| Glass card bg            | `rgba(255,255,255,0.04)` |

Dark theme is default; light theme toggled via `data-theme="light"` on `<html>`.

---

## Production Optimization Checklist

- [x] `OnPush` change detection on all components
- [x] Lazy-loaded routes for every page
- [x] AudioWorklet runs pitch detection off main thread
- [x] `ScriptProcessorNode` fallback for Capacitor WebViews
- [x] DynamoDB `TTL` on sessions and streaks (auto-cleanup)
- [x] Lambda ARM64 (Graviton2, ~20% cheaper than x86)
- [x] Lambda `PAY_PER_REQUEST` — no idle cost
- [x] CloudFront CDN for audio samples
- [x] Angular PWA service worker (`ngsw-config.json`) caching
- [x] Tanpura additive synthesis fallback (no network required)
- [x] esbuild for Lambda bundles (fast cold start)
- [ ] Enable DynamoDB DAX for sessions table in prod (optional)
- [ ] Add CloudWatch alarms for Lambda error rates
- [ ] Add Cognito MFA for guru accounts
- [ ] Upload tanpura `.wav` samples to S3 audio bucket

---

## Tech Stack Summary

| Layer        | Technology                              |
|-------------|-----------------------------------------|
| Mobile UI    | Ionic 8, Angular 21, Tailwind CSS 3.4  |
| State        | Angular Signals + RxJS                 |
| Native       | Capacitor 7 (iOS + Android)            |
| Audio        | Web Audio API + AudioWorklet           |
| Pitch        | YIN algorithm (pure TS)                |
| Auth         | AWS Cognito + Amplify v6               |
| API          | AWS API Gateway HTTP API               |
| Compute      | AWS Lambda (Node 22, ARM64)            |
| Database     | AWS DynamoDB (on-demand)               |
| Storage      | AWS S3 + CloudFront                    |
| Infra        | AWS CDK v2 (TypeScript)                |
| Monorepo     | Nx 21                                  |
