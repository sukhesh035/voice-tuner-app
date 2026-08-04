# "What's New" Per-Release Feature Tour Design

## Overview

Show a one-time-per-release slideshow tour to users, highlighting features added in each release. The tour appears automatically after the app boots whenever a new release is detected, and logs analytics for the tour flow.

Because the app ships JS updates via **OTA (Capgo)**, the release key is the **OTA update version** (`CapacitorUpdater.current().bundle.version`, e.g. `1.1.<run_number>`), not the native app version.

## Architecture

### 1. `FeatureTourService` (core service)

Responsible for deciding whether to show the tour and resolving the current release key.

```typescript
export interface FeatureSlide {
  icon: string;        // ionicons name or custom SVG name
  title: string;
  description: string;
  target?: string;     // optional route to deep-link (e.g. '/metronome')
}

export interface FeatureTourRelease {
  key: string;         // OTA version that introduced this tour
  slides: FeatureSlide[];
}
```

- **Curated tour content** — a `FeatureTourContent` constant, a `Record<releaseKey, FeatureSlide[]>` map keyed by OTA version string. New slides are appended for each release key; to bound growth, only the last few version keys are kept (older ones are pruned).
- **Current release key resolution:**
  1. If native + OTA available → `CapacitorUpdater.current().bundle.version` (the true live OTA version, e.g. `1.1.42`)
  2. Else if native → `App.getInfo().version`
  3. Else (web/dev) → a compile-time `DEV_TOUR_KEY` constant
- **Last-seen tracking** — stored in `localStorage` under `swara-last-tour-key`.
- **`shouldShow(): boolean`** — true if current release key ≠ last-seen key AND the current key has slides defined.
- **`markShown()`** — writes current key to localStorage.
- **`getSlides(): FeatureSlide[]`** — slides for the current release key (empty if none).
- **`resolveCurrentKey(): Promise<string>`** — async because it awaits `CapacitorUpdater.current()`.

### 2. `FeatureTourComponent` (standalone, Ionic modal)

Full-screen slideshow presented via `ModalController`.

- **Slide UI:** icon, title, description, and an optional "Try it" button that navigates to `slide.target` and dismisses the modal.
- **Controls:** `Next`, `Skip` (top-right), final slide shows `Done`.
- **Analytics events:**
  - `feature_tour_started` — `{ release_key, total_steps }`
  - `feature_tour_step` — `{ release_key, step, total_steps }`
  - `feature_tour_completed` — `{ release_key, total_steps }`
  - `feature_tour_skipped` — `{ release_key }`
- On dismiss (any path), `markShown()` is called so it doesn't re-appear until the next release.

### 3. Trigger in `AppComponent`

After auth init resolves (in `ngOnInit`), call:

```typescript
this.tourService.maybeShowTour(this.modalCtrl).catch(() => {});
```

`maybeShowTour`:
1. Resolve current key.
2. If `shouldShow()` and slides exist → present the modal.
3. On dismiss, `markShown()`.

### 4. Initial curated content (first release with the tour)

The **current release key is resolved dynamically from the OTA bundle version** at runtime (`CapacitorUpdater.current().bundle.version`) — never hardcoded. The app is already released, so there is no fixed "1.1" baseline. From now on, each OTA publish should carry a proper, incrementing version, and the tour keys against whatever the live OTA version string is at that moment.

The release key used to gate slides is whatever `resolveCurrentKey()` returns (e.g. `1.1.42`). Slides are registered under descriptive release identifiers (e.g. the run number / version string) and shown once per change of that key.

Initial slides (shown for the first OTA version where the tour exists):
1. **Metronome & Tanpura** — two tabs in one screen; run a metronome alongside a tanpura drone. Target: `/metronome`
2. **Ear Training levels** — choose Beginner / Intermediate / Advanced difficulty. Target: `/practice`
3. **Janya ragas** — browse Melakarta parent ragas and their janya derivatives. Target: `/practice`

## Files

| File | Action |
|------|--------|
| `apps/mobile-app/src/app/core/services/feature-tour.service.ts` | Create — content + show logic |
| `apps/mobile-app/src/app/shared/components/feature-tour/feature-tour.component.ts` | Create — slideshow modal |
| `apps/mobile-app/src/app/shared/components/feature-tour/feature-tour.component.scss` | Create — styles |
| `apps/mobile-app/src/app/app.component.ts` | Modify — trigger tour after auth init |
| `apps/mobile-app/src/app/core/services/analytics.service.ts` | Modify — add `feature_tour_*` typed helpers (optional) |

## Success Criteria

- First launch of a new OTA version shows the slideshow once
- Skipping/completing persists so it does not re-appear until the next release
- Analytics logs started/step/completed/skipped with the release key
- Works on native (OTA version) and web/dev (compile-time key)
