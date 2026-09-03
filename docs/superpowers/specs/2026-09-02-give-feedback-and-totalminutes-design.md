# Design: Give Feedback (mobile → my-projects-admin) + sortable totalMinutes

Date: 2026-09-02
Status: Approved (design), autonomous execution

## Goals

1. Swara AI mobile home: replace the "Learn / Piano & Keyboard Lessons" card with a
   **Give Feedback** entry. Users submit feedback (name optional, category, 1–5 star
   rating, message) — anonymous allowed.
2. Feedback submissions appear **in the my-projects-admin portal under the swara-ai
   section as a list** (new "Feedback" page).
3. In the portal's View Users table (swara-ai), add a **sortable "Minutes"
   (totalMinutes) column**.

## Data model

DynamoDB table `swara-{stage}-feedback` (PAY_PER_REQUEST), partition key `feedbackId`
(string). Item:

```ts
{ feedbackId: string; name: string; category: 'comment' | 'suggestion' | 'problem';
  rating: number /*1-5*/; message: string; createdAt: string /*ISO*/ }
```

`totalMinutes` already lives on each user row as `stats.totalMinutes` (number, default 0,
maintained by streaks checkin). No new user-schema work.

## Wire contracts

- **Public POST** `{apiBase}/api/feedback` (no JWT authorizer — first public POST route).
  Body: `{ name?: string; category: 'comment'|'suggestion'|'problem'; rating: number;
  message: string }`. Validation: category enum; rating integer 1–5; message trimmed
  length 1–2000; name trimmed ≤80 (default `''`). Response 201 `{ feedbackId, createdAt }`.
  (Auth token is attached by the app interceptor only when logged in; handler ignores it —
  name is entered by the user, pre-filled from the profile when available.)
- **Swara admin-api GET** `/feedback` (Bearer service token): 200
  `{ feedback: FeedbackRow[], total }`, newest first (`createdAt` desc).
  `FeedbackRow = { feedbackId, name, category, rating, message, createdAt }`.
- **Portal proxy GET** `/v1/apps/swara-ai/feedback`: admin-authenticated; forwards the
  Swara admin-api response unchanged (same service-token flow as View Users).
- **Users rows (Swara admin-api GET /users)** now include `totalMinutes: number`
  (`Number(stats?.totalMinutes ?? 0)`), and `sortBy=totalMinutes` is supported with a
  **numeric** comparator (existing sort compares strings).

## Mobile (Swara repo)

1. `home.page.ts`: replace the Learn / Piano & Keyboard Lessons card block with a
   "Give Feedback" card routed to `/feedback` (reuse the `.learn-card` styles; no YouTube
   behavior remains on home).
2. New public page `pages/feedback/feedback.page.ts` (+ scss):
   - Category chips: Comment / Suggestion / Problem.
   - 1–5 star rating (tap to select).
   - Name input (optional, prefilled with logged-in user's display name).
   - Message textarea (required).
   - Submit disabled until rating chosen and message non-empty; inline success state
     ("thank you") and inline error handling; matches Ionic standalone conventions.
3. Route added to `app.routes.ts` (public).
4. `api.service.ts`: `addFeedback(payload)` → POST `${base}/api/feedback`.

## Swara backend + infra (Swara repo)

5. `swara-stack.ts`: feedback table + `FeedbackFn` lambda (`feedback` entry, commonEnv +
   `FEEDBACK_TABLE`) with table write grant; public POST route `/v1/api/feedback`
   (no authorizer). Add `FEEDBACK_TABLE` to admin-api env and read grant in
   `admin-api-stack.ts` (it references the table by name like the users table).
6. `handlers/feedback.handler.ts`: public handler with validation above → PutCommand.
   Register route in `local-server.ts` for local dev.
7. `admin-api/src/handler.ts`: add GET `/feedback` (service-token protected) scanning the
   feedback table → mapped rows sorted `createdAt` desc.

## Portal (my-projects-admin repo)

8. `shared-types` + admin-ui `models`: `FeedbackRow`; `UserRow` gains `totalMinutes: number`.
9. admin-api `apps-config.ts`: swara-ai gains action
   `{ id: 'feedback', label: 'Feedback', icon: '💬' }`.
10. admin-api `admin.handler.ts`: `GET /v1/apps/swara-ai/feedback` proxy (canAccess guard,
    SSM service-token, `callApi` GET `/feedback`).
11. admin-ui:
    - nav.config: `NAV_ORDER` += `'feedback'`; `ACTION_NAV_MAP['feedback']` →
      `{ label: 'Feedback', icon: '💬', route: 'feedback' }`.
    - `app.routes.ts`: child `{ path: 'feedback', component: FeedbackListComponent }`.
    - New `features/feedback-list` component: table of Rating / Category / Name / Message /
      Date, newest first (message cell wraps; no pagination).
    - `apps.service.getFeedback(appId)`.
    - `view-users`: "Minutes" sortable column, rendered **only when appId === 'swara-ai'**
      (other apps' APIs have no totalMinutes; don't send the sort param for them).

## Tests

- Swara admin-api `handler.spec.ts`: totalMinutes included in row mapping; numeric
  sortBy=totalMinutes ordering; GET /feedback returns mapped rows.
- Portal admin-api `admin.handler.spec.ts`: swara feedback proxy; apps-config.
- Portal admin-ui specs: nav config (Feedback item for swara), view-users (Minutes column
  gated to swara-ai, sort sends totalMinutes).

## Deploys (not part of code change)

swara-stack (dev/prod), swara admin-api stack, my-projects-admin admin-api/admin-ui, then
mobile PWA/capgo publish. Mobile `environment.ts` is generated from stack outputs by CI.
