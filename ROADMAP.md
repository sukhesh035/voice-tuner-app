# Swara AI — Feature Roadmap

Future feature ideas for Swara AI, organized by priority and effort level.
Each feature includes a description, user value, and rough implementation notes.

---

## Priority 1 — High Impact, Low Effort

### 1.1 Shruti Meter (Always-On Pitch Display)
**Description**: A real-time pitch meter on the home screen showing the current swara (Sa, Re, Ga, Ma...) relative to the selected key. Functions as a quick vocal/instrument tuner without entering a full practice session.

**User Value**: Users open the app just to tune their voice or instrument. Increases daily opens and session frequency. Essential utility feature for any musician.

**Implementation Notes**:
- Reuse the existing `AudioEngineService.enableMicrophone()` and pitch detection pipeline
- Add a compact pitch display widget to the home page (circular gauge or horizontal bar)
- Show: detected swara name, cents deviation (+/- from perfect pitch), Hz frequency
- Auto-stop after 60s of inactivity to save battery
- Works on home page without navigating to practice/sing modes

**Affected Files**: `home.page.ts`, `home.page.html`, possibly a new `SwaraGaugeComponent`

---

### 1.2 Raga of the Day
**Description**: Feature a different raga each day on the home screen with its aroh (ascending), avaroh (descending), vadi/samvadi swaras, and a "Practice Now" button that jumps directly into practice mode for that raga.

**User Value**: Drives daily engagement and discovery. Users learn new ragas they wouldn't have tried on their own. Pairs well with the daily push notification ("Today's raga: Yaman — tap to practice").

**Implementation Notes**:
- Create a curated list of ~100 ragas with metadata (aroh, avaroh, thaat, vadi, samvadi, time of day, mood, difficulty)
- Selection algorithm: rotate daily, optionally weighted by time of day (morning ragas in AM, evening ragas in PM)
- Store the raga list as a static JSON asset or in DynamoDB
- Home page card: raga name, thaat, aroh/avaroh notation, difficulty badge, "Practice Now" CTA
- Push notification enhancement: include raga of the day in the daily reminder message
- Backend: add a `GET /v1/api/ragas/today` endpoint or compute client-side from a seed

**Affected Files**: `home.page.ts`, `home.page.html`, new `raga-of-the-day.component.ts`, possibly `notifications.handler.ts`

---

### 1.3 Session History with Playback
**Description**: Record practice session audio and save it so users can listen back to their performances. Show a history list with date, raga, duration, score, and a play button.

**User Value**: Self-review is critical for improvement. Users can hear their mistakes, track progress over time, and share recordings with their guru.

**Implementation Notes**:
- Use `MediaRecorder` API to capture mic audio during practice sessions
- Save recordings as WebM/Opus (small file size, good quality)
- Upload to S3 `user-uploads` bucket under `recordings/{userId}/{sessionId}.webm`
- Add `recordingUrl` field to the sessions DynamoDB table
- Session history page: list sessions with playback controls (existing session list + audio player)
- Consider storage limits: cap at 50 recordings for free tier, unlimited for future Pro
- Offline: cache last 5 recordings locally using Capacitor Filesystem

**Affected Files**: `practice.page.ts`, `sing.page.ts`, `sessions.handler.ts`, `session-report.page.ts`, `api.service.ts`, S3 bucket CORS config

---

### 1.4 Share Practice Streak
**Description**: Generate a shareable image card showing the user's practice streak, total sessions, and a Swara AI branded design. One-tap share to Instagram Stories, WhatsApp, or general share sheet.

**User Value**: Social proof and bragging rights drive continued practice. Organic app marketing when shared on social media.

**Implementation Notes**:
- Generate a canvas-based image (or use a pre-designed SVG template) with:
  - Current streak count (flame icon)
  - Total practice minutes this week/month
  - User's display name
  - Swara AI branding and app store link
- Use Capacitor `@capacitor/share` plugin for native share sheet
- For Instagram Stories: use the share sheet with image — Instagram will auto-detect
- Add "Share Streak" button on the progress page and on milestone achievements (7 days, 30 days, etc.)
- Track shares via analytics: `streak_shared` event

**Affected Files**: `progress.page.ts`, new `streak-card.component.ts`, new `share.service.ts`

---

## Priority 2 — High Impact, Medium Effort

### 2.1 Guided Raga Lessons (Progressive Difficulty)
**Description**: Structured step-by-step lessons for each raga instead of jumping straight into free practice. Progression: (1) Listen to aroh/avaroh, (2) Sing aroh with guidance, (3) Sing avaroh, (4) Learn key phrases (pakad), (5) Free practice with AI feedback.

**User Value**: Beginners are overwhelmed by free practice. Guided lessons lower the barrier to entry and teach proper technique. Increases completion rates and user confidence.

**Implementation Notes**:
- Define a lesson schema: `{ ragaId, steps: [{ type: 'listen' | 'sing_aroh' | 'sing_avaroh' | 'phrases' | 'free', instructions, referenceAudio? }] }`
- Each step has pass criteria (e.g., aroh accuracy > 70% to proceed)
- Progress tracked per user per raga in DynamoDB: `lessonProgress` map on user profile or a separate lessons table
- UI: step indicator at top, contextual instructions, visual cues for what to sing next
- Reuse existing practice mode engine; wrap it with lesson context
- Start with 10-15 beginner-friendly ragas (Yaman, Bhairav, Bhupali, Malkauns, etc.)

**Affected Files**: New `lesson.page.ts`, new `lesson.service.ts`, `ragas` data model, backend lesson progress endpoints

---

### 2.2 Swara Accuracy Breakdown
**Description**: After a practice session, show a detailed breakdown of accuracy per swara — which notes were sharp, flat, or on-pitch. Visualize as a bar chart or radar chart with each swara on an axis.

**User Value**: Users currently get a single overall score but no actionable feedback. Knowing "your Ga is consistently sharp" gives them something specific to work on. This is the #1 thing a guru would tell a student.

**Implementation Notes**:
- During pitch detection, accumulate per-swara statistics: `{ swara: 'Ga', attempts: 45, avgCentsDeviation: +12, hitRate: 0.73 }`
- At session end, compute per-swara accuracy and deviation
- Display as:
  - Radar/spider chart with 7 swaras (Sa Re Ga Ma Pa Dha Ni) as axes
  - Color-coded: green (within 10 cents), yellow (10-25 cents), red (>25 cents)
  - Specific tips: "Your Ga tends sharp by ~15 cents. Try approaching it from Re."
- Store per-swara stats in session record for historical tracking
- Progress page enhancement: show swara accuracy trends over time

**Affected Files**: `practice.page.ts`, `session-report.page.ts`, new `swara-chart.component.ts`, `sessions.handler.ts` (add swaraStats to session schema)

---

### 2.3 Tonic Key with Custom Frequency
**Description**: Let users set their Sa (tonic) to any frequency, not just standard Western keys. Important for vocalists who have a natural tonic that doesn't align with A=440Hz, and for instrumentalists tuning to a specific pitch.

**User Value**: Every vocalist has a unique comfort tonic. Sitar and sarangi players tune to non-standard pitches. This makes the app usable for serious musicians, not just beginners.

**Implementation Notes**:
- Add a frequency selector (slider or number input) alongside the existing key selector
- Range: 100Hz - 500Hz (covers most vocal ranges)
- Snap-to-key option: show nearest Western key name but allow fine-tuning
- Update `TanpuraPlayerService` to transpose drone to the custom frequency
- Update pitch detection to calculate swaras relative to the custom tonic
- Persist `tonicFrequency` in user preferences

**Affected Files**: `tanpura-player.service.ts`, pitch detection logic in `audio-engine`, settings page, `api.service.ts`

---

### 2.4 Metronome / Taal Integration
**Description**: Overlay rhythmic cycles (taal) on top of the tanpura drone during practice. Support common taals: Teentaal (16 beats), Jhaptaal (10 beats), Ektaal (12 beats), Rupak (7 beats), and Keherwa (8 beats).

**User Value**: Rhythm is half of Indian classical music. Currently the app only addresses pitch. Adding taal support makes it a complete practice tool and fills a major gap in existing apps.

**Implementation Notes**:
- Create a `TaalService` with:
  - Taal definitions: name, beats (matras), divisions (vibhags), sam/khali positions
  - Audio samples: tabla bols for each beat (Dha, Dhin, Ta, Tin, Na, etc.)
  - Tempo control (BPM) synced with the tanpura
- Visual: circular or linear beat indicator showing current position in the cycle, highlight sam (beat 1)
- Audio: play tabla bol samples in sequence at the selected tempo
- Integration: toggle taal on/off during practice, independent of tanpura
- Start with 5 core taals, expand later

**Affected Files**: New `taal.service.ts`, new `taal-indicator.component.ts`, `practice.page.ts`, `tanpura.page.ts`, audio assets for tabla bols

---

## Priority 3 — Medium Impact, Medium Effort

### 3.1 Community Leaderboard
**Description**: Weekly and monthly leaderboards showing top practitioners by practice minutes, streak length, or session count. Opt-in only to respect privacy.

**User Value**: Gamification and social competition drive retention. Users who see others practicing are motivated to keep their own streak alive.

**Implementation Notes**:
- Backend: aggregate practice data weekly/monthly, store top 50 in a leaderboard DynamoDB table or compute on-demand
- Leaderboard entry: `{ rank, displayName, photoUrl, practiceMinutes, streak, raagaCount }`
- UI: tab on progress page or separate leaderboard page
- Privacy: opt-in via settings toggle (`leaderboardOptIn` preference)
- Consider: per-raga leaderboards ("Top Yaman practitioners this week")
- Anti-gaming: cap countable minutes per day (e.g., max 60 min/day counts toward leaderboard)

**Affected Files**: New `leaderboard.page.ts`, new backend `leaderboard.handler.ts`, `sruti-stack.ts` (new table + Lambda), settings page

---

### 3.2 Bandish Library
**Description**: A searchable library of popular bandish (compositions) for each raga, showing lyrics (with sargam notation), audio recordings of reference renditions, and the ability to practice along with them.

**User Value**: Users want to learn actual compositions, not just scales. A bandish gives context and musicality to raga practice. This is what makes the app feel like a real music education tool.

**Implementation Notes**:
- Data model: `{ bandishId, ragaId, title, composer, taal, lyrics, sargamNotation, audioUrl, difficulty }`
- Curate 50-100 popular bandishes across common ragas to start
- Audio: record or source reference renditions (ensure licensing)
- UI: searchable list filtered by raga, taal, or difficulty
- Practice integration: "Practice this bandish" opens practice mode with the bandish as reference
- Storage: bandish metadata in DynamoDB, audio files in S3 audio assets bucket

**Affected Files**: New `bandish.page.ts`, new `bandish.service.ts`, backend `bandish.handler.ts`, DynamoDB table, S3 audio assets

---

### 3.3 Offline Mode
**Description**: Allow core features (tanpura drone, pitch detection, practice with cached ragas) to work without an internet connection. Sync data when connectivity returns.

**User Value**: Many Indian classical music students practice in locations with poor internet (practice rooms, temples, rural areas). Offline support removes a major barrier.

**Implementation Notes**:
- Tanpura audio samples: already loaded from CDN, cache locally using Capacitor Filesystem or Service Worker
- Pitch detection: runs entirely client-side (Web Audio API), already works offline
- Raga data: cache raga metadata locally on first load
- Session recording: save locally, upload to backend when online
- Streak/session logging: queue API calls in IndexedDB, replay on reconnect
- Use `@capacitor/network` to detect connectivity changes
- PWA: already has a service worker; enhance caching strategy

**Affected Files**: New `offline.service.ts`, `api.service.ts` (add request queue), `capacitor.config.ts`, service worker config

---

### 3.4 Practice Goals and Weekly Reports
**Description**: Users set a weekly practice goal (e.g., 60 minutes/week or 5 sessions/week). At the end of each week, send a push notification with a summary: total minutes, sessions, accuracy trends, streak status, and encouragement.

**User Value**: Goal-setting increases commitment. Weekly reports create a habit loop and give users a sense of progress even when daily improvements are subtle.

**Implementation Notes**:
- Add `weeklyGoalMinutes` to user preferences (default: 60)
- Backend: scheduled Lambda (Sunday evening) that computes weekly stats per user and sends a personalized push notification
- Notification content: "This week: 4 sessions, 38 min practiced. You're 63% to your goal. Keep going!"
- Optional: email report with charts (future enhancement)
- Progress page: show weekly goal progress bar

**Affected Files**: Settings page, `notifications.handler.ts` (add weekly report job), new EventBridge rule, `progress.page.ts`

---

## Priority 4 — Differentiators (High Impact, High Effort)

### 4.1 AI Raga Identification
**Description**: User sings or plays a phrase, and the app identifies which raga it belongs to. Shows top 3 candidates with confidence scores and explains why (matching swaras, characteristic phrases detected).

**User Value**: A "Shazam for ragas" — unique feature that no competitor offers well. Useful for students who hear a raga and want to know what it is, or for validating their own singing.

**Implementation Notes**:
- Approach 1 (rule-based): Extract swara sequence from pitch detection → match against raga swara sets → rank by pakad (characteristic phrase) matching
- Approach 2 (ML): Train a classifier on labeled raga recordings (dataset needed: ~50 recordings per raga for 50 ragas)
- Likely start with rule-based (can be done client-side) and enhance with ML later
- Input: 10-30 seconds of singing
- Output: top 3 raga matches with confidence %, swara set display, "sounds like Yaman because of tivra Ma and Ni"
- UI: dedicated "Identify Raga" mode accessible from home page

**Affected Files**: New `raga-identifier.service.ts`, new `identify.page.ts`, raga metadata with swara sets and pakad patterns

---

### 4.2 Guru Feedback Requests
**Description**: Students record a practice session and send it to their guru (teacher) via the classroom system. The guru listens to the recording and leaves timestamped comments (e.g., at 0:23 — "Your Dha is flat here, try again").

**User Value**: Bridges the gap between in-person lessons. Gurus can review student practice remotely and give specific, actionable feedback. Makes the classroom feature dramatically more valuable.

**Implementation Notes**:
- Depends on: Session History with Playback (1.3) being implemented first
- Student flow: after a session, tap "Send to Guru" → selects guru from classroom → submits recording with session metadata
- Guru flow: notification received → opens recording in a review UI → taps on waveform to add timestamped comments
- Data model: `{ feedbackId, sessionId, studentId, guruId, comments: [{ timestamp, text }], createdAt }`
- New DynamoDB table or extend sessions table
- Push notification to guru when feedback is requested, to student when feedback is given

**Affected Files**: New `feedback.service.ts`, `session-report.page.ts`, new `guru-review.page.ts`, backend `feedback.handler.ts`, classroom integration

---

### 4.3 Comparative Playback
**Description**: Play a reference rendition of a raga phrase side-by-side with the user's recorded attempt. Overlay both pitch contours on the same graph so the user can visually see where they diverge from the reference.

**User Value**: Visual comparison is the most intuitive way to understand pitch errors. Seeing your pitch curve next to the ideal one is worth more than any numerical score.

**Implementation Notes**:
- Depends on: Session History with Playback (1.3)
- Reference recordings: curated "ideal" renditions for each raga's aroh, avaroh, and key phrases
- Pitch extraction: run pitch detection on both reference and user recordings
- Visualization: dual-line chart (reference in blue, user in orange) with swara grid lines
- Time alignment: use DTW (Dynamic Time Warping) to align the two pitch sequences despite tempo differences
- UI: split screen — top half shows pitch comparison, bottom half has playback controls for both

**Affected Files**: New `comparative-player.component.ts`, new `pitch-comparison.service.ts`, `session-report.page.ts`, reference audio assets

---

## Implementation Order (Suggested)

| Phase | Features | Timeframe |
|-------|----------|-----------|
| Phase 1 | 1.2 Raga of the Day, 1.4 Share Streak | 1 week |
| Phase 2 | 1.1 Shruti Meter, 2.2 Swara Accuracy Breakdown | 1-2 weeks |
| Phase 3 | 2.4 Taal Integration, 1.3 Session History | 2-3 weeks |
| Phase 4 | 2.1 Guided Lessons, 3.2 Bandish Library | 2-3 weeks |
| Phase 5 | 3.1 Leaderboard, 3.4 Weekly Reports | 1-2 weeks |
| Phase 6 | 3.3 Offline Mode, 2.3 Custom Tonic | 1-2 weeks |
| Phase 7 | 4.1 AI Raga ID, 4.2 Guru Feedback, 4.3 Comparative Playback | 4-6 weeks |

---

*Last updated: March 2026*
