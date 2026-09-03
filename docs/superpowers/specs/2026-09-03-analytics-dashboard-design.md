# Design: Analytics dashboard for swara-ai (Our analytics + Google analytics)

Date: 2026-09-03
Status: Approved (design). Autonomous implementation.

## Goals

Give the developer (in my-projects-admin, swara-ai section) usage analytics that
count **both signed-up and anonymous users**, surfaced as a new **Analytics** page
with two tabs: **Our analytics** (backend-owned data) and **Google analytics**
(read-only GA4).

Decisions (from brainstorming):
- NO IP-based tracking (unreliable, privacy baggage).
- Anonymous users counted via a **local anonymous install-ID** (UUID) that the app
  sends on each open/foreground to a new public backend endpoint.
- Install-ID stored in **localStorage** (works in native WebView + web; cleared on
  uninstall = reset on reinstall). No new native plugin ⇒ **no new Apple build** —
  ships as Capgo live update.
- Portal "Our analytics" tab covers signups (users table), sessions/minutes
  (sessions table), and active devices incl. anonymous (new analytics table).
- Portal "Google analytics" tab reads GA4 via the Analytics Data API using the
  existing swara Firebase service account. No IPs.
- Charts: add **chart.js** to the portal.

## Wire contracts

### Anonymous open event — PUBLIC
`POST {apiBase}/api/analytics/open`
Body: `{ installId: string; platform?: 'ios'|'android'|'web' }`.
Validation: installId string, trimmed, 8..100 chars, non-empty (UUID-ish). platform
optional enum. Optional Authorization ignored (public). Response 201 `{ ok: true }`.

Storage (DynamoDB table `swara-{stage}-analytics`, PAY_PER_REQUEST):
- PK `day#<YYYY-MM-DD>` (UTC), SK = installId.
- Attributes: `installId`, `userId?` (set ONLY when the caller is authenticated and we
  decode it — actually keep `userId` OUT for now: name/detail not needed; note: no
  userId stored to keep it purely anonymous. Cross-check signed-in coverage comes from
  sessions/streaks tables instead.)
- `platform`, `lastSeen` (ISO).
- TTL ~400 days. PutItem is idempotent per day (same install twice/day → one row).

### Our analytics — swara admin-api `GET /analytics/our` (Bearer service token)
Response 200:
```ts
{
  totals: { registeredUsers: number; sessions: number; practiceMinutes: number;
            dau: number; wau: number; mau: number },
  series: [{ date: 'YYYY-MM-DD'; signups: number; activeDevices: number;
             sessions: number; minutes: number }] // trailing 30 days, oldest first
}
```
- registeredUsers = count of users table.
- signups/day = users grouped by UTC day of createdAt.
- sessions & minutes/day = sessions table grouped by day (minutes = duration/60, duration
  stored in seconds).
- activeDevices/day = analytics table item count per day pk.
- dau/wau/mau = distinct install-IDs over last 1 / 7 / 28 days (query 1..28 day pks, union
  counts).
- Implemented by Scan of users + sessions (small scale; paginate if needed) + Query on
  analytics day keys.

### Google analytics — swara admin-api `GET /analytics/ga4` (Bearer service token)
Response 200:
```ts
{ configured: boolean;
  dau?: number; wau?: number; mau?: number; newUsers30d?: number;
  series?: [{ date: string; activeUsers: number }] }
```
`configured:false` when the GA4 property id or service account is not set/readable.
- Property id: SSM param `/swara-{stage}/ga4-property-id`.
- SA JSON: SSM param `/swara-{stage}/firebase-sa-key` (already exists; same as the
  notifications Lambda).
- Calls `POST https://analyticsdata.googleapis.com/v1beta/properties/{id}:runReport`
  with a JWT signed by the SA (`iss`=client_email, scope `https://www.googleapis.com/auth/analytics.readonly`).
  - daily series: date dimension + activeUsers, last 30 days.
  - dau/wau/mau: metric activeUsers for dateRanges [today], [last 7 days], [last 28 days].
  - newUsers30d: metric newUsers, last 30 days.
- Admin-api Lambda needs IAM: ssm:GetParameter on `/swara-{stage}/firebase-sa-key` and
  `/swara-{stage}/ga4-property-id`; env `ANALYTICS_TABLE`, `USERS_TABLE`, `SESSIONS_TABLE`.

### Portal proxy — my-projects-admin admin-api
`GET /v1/apps/swara-ai/analytics/our` and `/v1/apps/swara-ai/analytics/ga4`
admin-authenticated; `canAccess(ctx,'swara-ai')`; forwards to swara admin-api
(`/analytics/our`, `/analytics/ga4`) using the existing service-token flow. Other apps
rejected/404.

## Swara repo changes

1. `infra/swara-stack.ts`: analytics table + `AnalyticsFn` (entry `analytics`) + public
   route POST `/v1/api/analytics/open` (no authorizer) + `ANALYTICS_TABLE` in commonEnv +
   table grant. `infra/admin-api-stack.ts`: env `USERS_TABLE`/`SESSIONS_TABLE`/
   `ANALYTICS_TABLE` + read grants; IAM for the two SSM params; keep everything else.
   Add SSM placeholder param `/swara-{stage}/ga4-property-id` (PLACEHOLDER) where other
   params are written.
2. `backend-api/handlers/analytics.handler.ts`: public POST open handler (validation +
   PutItem). Register route in `local-server.ts`. Add esbuild entry `analytics.js` in
   `backend-api/project.json` (same pattern as `feedback.js`).
3. `backend-api/project.json` esbuild list += analytics.
4. `admin-api/src/analytics.ts` (new): `computeOurAnalytics()` and `fetchGa4()` helpers.
   `admin-api/src/handler.ts`: wire `GET /analytics/our`, `GET /analytics/ga4`.
5. `.github/workflows/deploy-dev.yml` loop += `analytics`.
6. Mobile app: `core/services/usage.service.ts` — install-ID get/create (localStorage key
   `swara_install_id`), `reportOpen()` calls `ApiService.postOpen(...)`; fire once per
   foreground session from `app.component.ts` (same place analytics `logAppOpen` runs),
   and on `app_foreground` resume (throttled). `ApiService.reportAppOpen(installId,
   platform)` → POST `/api/analytics/open`.
   No analytics when `!environment.production`? No — send in dev too (harmless, useful for
   testing). Keep it quiet on failure.

## Portal repo changes

1. `libs/shared-types` + admin-ui models: `AnalyticsOur`, `AnalyticsGa4` interfaces.
2. `admin-api/lib/apps-config.ts`: swara-ai actions += `{ id:'analytics', label:
   'Analytics', icon:'📈' }` (swara only).
3. `admin-api/handlers/admin.handler.ts`: proxy routes (swara only) for
   `/analytics/our`, `/analytics/ga4`.
4. admin-ui `core/config/nav.config.ts`: NAV_ORDER += `analytics`; ACTION_NAV_MAP
   `analytics` → route `analytics`. Update nav spec.
5. admin-ui `app.routes.ts`: child `analytics` → `AnalyticsComponent`.
6. New `features/analytics/analytics.component.*` (tab switcher — Our analytics /
   Google analytics), `analytics-our.component.*`, `analytics-ga4.component.*`, and a
   small `core/components/chart` wrapper over **chart.js** (line + bar). Add `chart.js`
   dependency (+ `@types/chart.js` if not bundled). Styles follow existing `gcp-*`
   Tailwind classes.
7. `apps.service`: `getOurAnalytics(appId)`, `getGa4Analytics(appId)`.
8. GA4 tab shows a clear "not configured" empty state when `configured:false` (tells the
   owner to set the property id / SA access).

## Google setup (owner, after code ships)

1. Add the firebase SA (`firebase-adminsdk-…@swara-ai-4caf4.iam.gserviceaccount.com`) as
   **Viewer** on the swara GA4 property.
2. Set SSM `/swara-{stage}/ga4-property-id` (per stage).

## Tests

- swara admin-api spec: `/analytics/our` shape & grouping; `/analytics/ga4` configured:
  false path; proxy routes in portal admin-api spec.
- portal admin-ui specs: nav includes Analytics for swara only; analytics components
  render (mock service).

## Deploy

Dev-first (swara): build backend + admin-api, `cdk deploy SwaraStackDev`, push dev (CI
updates lambdas incl. analytics + rebuilds PWA). Portal: push main (auto prod portal).
Swara prod endpoints land only when owner merges dev→main (explicit, prod untouched
until then).
