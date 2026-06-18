# Premium Tuners & Subscription — Design Spec

**Date:** 2026-06-17  
**Status:** Awaiting user review  
**Scope:** RevenueCat IAP integration, Indian-scale guitar tuner, Indian-scale violin tuner, navigation restructure

---

## 1. Goal

Introduce the first paid features in Swara AI — an Indian-scale guitar tuner and violin tuner — gated behind a single subscription tier. Monetisation is via Apple App Store and Google Play Store native In-App Purchase, managed through RevenueCat. Navigation is restructured to accommodate a dedicated Tune tab and to retire the Tanpura tab.

---

## 2. Navigation Changes

### 2.1 Tab Bar (before → after)

| Before | After |
|--------|-------|
| Home | Home |
| Tanpura | Sing |
| Sing | Practice |
| Practice | **Tune** (new) |
| Profile | Profile |

5 tabs → 5 tabs. Tanpura tab is removed; Tune tab is added.

### 2.2 Tanpura Access

The Tanpura page (`/tanpura`) continues to exist as a route. It is accessed via the existing Quick Action card on the Home page ("Tanpura / Drone Player"). No change to the card or the Tanpura page itself — only the tab bar entry is removed.

### 2.3 Tune Tab

Route: `/tune`  
Icon: `options-outline` (Ionic — closest available to a tuning fork)  
Auth guard: none (page is visible to all; premium gate fires on activation)

`/tune` is a hub page with two feature cards:

| Card | Route | Premium required |
|------|-------|-----------------|
| Guitar Tuner | `/tune/guitar` | Yes |
| Violin Tuner | `/tune/violin` | Yes |

Both cards display a visible premium badge. Free users can navigate to the hub and see the cards. Tapping a card navigates to the tuner page; if the user is not premium, a paywall modal fires before the microphone is enabled.

---

## 3. Subscription Model

### 3.1 Products

Two products configured in App Store Connect and Google Play Console, then mirrored in RevenueCat:

| Product ID | Type | Example price (India) |
|------------|------|----------------------|
| `swara_premium_monthly` | Auto-renewing subscription | ₹199/month |
| `swara_premium_annual` | Auto-renewing subscription | ₹1499/year (~37% saving) |

**Multi-currency:** Prices are set as price tiers in App Store Connect and Google Play Console (not as fixed currency amounts). Both stores automatically convert to the user's local currency for 175+ countries. Per-country overrides are possible from the store consoles. The app never handles currency — `SubscriptionService.getOfferings()` returns `package.product.priceString` already formatted in the user's local currency and locale (e.g. `"$4.99"` for US, `"£3.99"` for UK, `"₹199"` for India). The paywall modal renders this string directly.

### 3.2 RevenueCat Configuration

- **Entitlement:** `premium` — both products grant this entitlement.
- **Offering:** `default` — contains both packages (`monthly`, `annual`). The paywall modal fetches the active offering at runtime so prices can be changed from the RevenueCat dashboard without an app release.
- **App Store Connect:** One subscription group "Swara Premium" containing both products.
- **Google Play:** One subscription with two base plans.

### 3.3 Free Trial

No free trial. Users are charged immediately on subscribe.

### 3.4 Restore Purchases

A "Restore Purchases" button is present in the paywall modal (required by App Store guidelines). Calls `SubscriptionService.restorePurchases()`.

---

## 4. Frontend Architecture

### 4.1 New Library: `libs/subscription/`

Follows the same structure as `libs/auth/`, `libs/audio-engine/`, etc.

```
libs/subscription/
└── src/
    ├── index.ts                        # barrel export
    └── lib/
        └── subscription.service.ts
```

`SubscriptionService` is an Angular singleton (`providedIn: 'root'`):

| Member | Type | Description |
|--------|------|-------------|
| `isPremium$` | `Observable<boolean>` | Emits true when `premium` entitlement is active |
| `isPremium()` | `() => boolean` | Angular Signal-based synchronous read for template use |
| `initialize(apiKey)` | `Promise<void>` | Called once in `app.config.ts` at boot. Configures RevenueCat SDK with platform API key |
| `getOfferings()` | `Promise<Offerings>` | Fetches current offering from RevenueCat (cached) |
| `purchase(rcPackage)` | `Promise<void>` | Triggers native IAP sheet. Throws on cancellation/error |
| `restorePurchases()` | `Promise<void>` | Restores previous purchases. Updates entitlement state |
| `logIn(userId)` | `Promise<void>` | Called after Cognito sign-in so RevenueCat associates purchases with the user |
| `logOut()` | `Promise<void>` | Called on sign-out |

RevenueCat SDK: `@revenuecat/purchases-capacitor`

The service listens to `Purchases.addCustomerInfoUpdateListener` and updates the `isPremium` signal whenever entitlement state changes (e.g. subscription renews or expires in background).

### 4.2 New Component: `PaywallModalComponent`

Location: `apps/mobile-app/src/app/shared/components/paywall-modal/`

Full-screen Ionic modal. Content:

1. **Header** — "Unlock Swara Premium" with close button
2. **Feature list** — bullet list of what's included (guitar tuner, violin tuner, future features)
3. **Pricing cards** — rendered from `SubscriptionService.getOfferings()`, one card per package. Annual card shows savings badge. Selected package highlighted.
4. **Subscribe CTA** — calls `SubscriptionService.purchase(selectedPackage)`
5. **Restore Purchases** link — calls `SubscriptionService.restorePurchases()`
6. **Legal** — "Cancel anytime. Managed by Apple/Google." + Privacy Policy + Terms links

Loading state: skeleton cards while offerings fetch. Error state: "Could not load pricing. Try again." with retry button.

### 4.3 New Pages

**`pages/tune/tune.page.ts`** (hub)
- Two feature cards (Guitar Tuner, Violin Tuner)
- Each card shows instrument name, a short description, and a premium lock icon overlay
- Premium users see the lock replaced with an arrow/chevron
- No microphone access on this page

**`pages/tune/guitar/guitar-tuner.page.ts`**
- On `ionViewWillEnter`: check `subscriptionService.isPremium()`. If false, open `PaywallModalComponent` and return without enabling mic.
- If premium: enable microphone via `AudioEngineService`, subscribe to `PitchDetectionService.smoothPitch$`
- On `ionViewWillLeave`: disable microphone

**`pages/tune/violin/violin-tuner.page.ts`**
- Same gate pattern as guitar tuner

### 4.4 Soft Gate Pattern

Both tuner pages follow this pattern:

```typescript
async ionViewWillEnter() {
  if (!this.subscriptionService.isPremium()) {
    const modal = await this.modalCtrl.create({
      component: PaywallModalComponent,
      cssClass: 'paywall-modal',
    });
    await modal.present();
    return; // do not start audio
  }
  await this.startTuner();
}

ionViewWillLeave() {
  this.stopTuner();
}
```

If the user subscribes inside the paywall modal, the modal dismisses with `role: 'purchased'`. The tuner page listens to the modal dismiss event:

```typescript
const { role } = await modal.onWillDismiss();
if (role === 'purchased') {
  await this.startTuner(); // isPremium() is now true
}
```

This avoids relying on `ionViewWillEnter` re-firing (which Ionic does not guarantee after a modal dismiss on the same page).

### 4.5 `app.config.ts` Changes

- Import `SubscriptionService` and call `subscriptionService.initialize(environment.revenueCatApiKey)` in the app initializer.
- Call `subscriptionService.logIn(userId)` after successful Cognito sign-in (wire into `AuthService.signIn()` success path).
- Call `subscriptionService.logOut()` after `AuthService.signOut()`.

### 4.6 Environment Config

```typescript
// environment.ts / environment.prod.ts
revenueCat: {
  appleApiKey: 'appl_xxxxxxxx',
  googleApiKey: 'goog_xxxxxxxx',
}
```

Platform-specific key selected at runtime:
```typescript
const apiKey = Capacitor.getPlatform() === 'ios'
  ? environment.revenueCat.appleApiKey
  : environment.revenueCat.googleApiKey;
```

---

## 5. Indian-Scale Tuner Logic

Both tuners reuse `PitchDetectionService` without modification. The tuner pages contain only display logic and string reference tables.

### 5.1 Guitar — Indian-Scale Strings

The user's `defaultKey` preference (already stored in DynamoDB and loaded on app start) determines Sa. All string target frequencies are computed relative to Sa.

| String | Indian interval | Semitone offset from Sa | Example (Sa = D) |
|--------|-----------------|------------------------|-----------------|
| 6 (low) | Sa (2 oct below) | -24 | D2 — 73.4 Hz |
| 5 | Pa (1 oct below) | -17 | A2 — 110.0 Hz |
| 4 | Sa (1 oct below) | -12 | D3 — 146.8 Hz |
| 3 | Ma | -5 | G3 — 196.0 Hz |
| 2 | Sa | 0 | D4 — 293.7 Hz |
| 1 (high) | Pa | +7 | A4 — 440.0 Hz |

Target frequency for string n: `saFrequency * 2^(semitoneOffset/12)`

### 5.2 Violin — Indian-Scale Strings

Indian classical violin is tuned Pa-Sa-Pa-Sa:

| String | Indian interval | Semitone offset from Sa | Example (Sa = C) |
|--------|-----------------|------------------------|-----------------|
| 4 (low) | Pa (1 oct below) | -17 | G3 — 196.0 Hz |
| 3 | Sa | 0 | C4 — 261.6 Hz |
| 2 | Pa | +7 | G4 — 392.0 Hz |
| 1 (high) | Sa (1 oct above) | +12 | C5 — 523.3 Hz |

### 5.3 Tuner UI Per String

- String selector: row of string buttons (labelled with Indian name + semitone offset). User taps to select which string to tune.
- Active string highlighted.
- Gauge: horizontal needle or arc meter centred on 0¢. Range: −50¢ to +50¢.
  - Red zone: beyond ±25¢
  - Yellow zone: ±10¢ to ±25¢
  - Green zone: within ±10¢
- Numeric cents display: e.g. `−12¢` (updates in real time from `smoothPitch$`)
- In-tune indicator: green glow pulse animation when within ±5¢ for 500ms
- Note name display: shows the detected note name + octave (from `PitchDetectionService`)
- Sa key display: shows the current Sa (e.g. "Sa = D") with a small link to Settings to change it

`PitchDetectionService.setSa(targetFrequency)` is called on page enter with the Sa frequency derived from `defaultKey`. The service then reports `centsOff` relative to the nearest Indian swara, but for tuner purposes the page computes cents deviation directly from the target string frequency:

```typescript
centsFromTarget = 1200 * Math.log2(detectedFrequency / targetStringFrequency)
```

This is calculated in the page component, not in the shared service (the service is unchanged).

---

## 6. Backend Changes

### 6.1 DynamoDB `swara-users` Schema Addition

Three new fields added to `UserProfile`:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `isPremium` | Boolean | `false` | True when an active `premium` entitlement exists |
| `premiumSince` | String (ISO) | undefined | Timestamp of first successful purchase |
| `premiumExpiresAt` | String (ISO) | undefined | Expected next renewal / expiry date from RevenueCat event |

### 6.2 New Lambda: `webhook.handler.ts`

Location: `apps/backend-api/src/handlers/webhook.handler.ts`

Route: `POST /api/webhooks/revenuecat` (no Cognito JWT authorizer — this is server-to-server)

**Security:** RevenueCat sends an `Authorization` header with a shared secret. The handler validates this against `process.env.REVENUECAT_WEBHOOK_SECRET` before processing. Returns `401` if invalid.

**Handled event types:**

| RevenueCat event | Action |
|-----------------|--------|
| `INITIAL_PURCHASE` | Set `isPremium: true`, set `premiumSince` (if not already set), set `premiumExpiresAt` |
| `RENEWAL` | Set `isPremium: true`, update `premiumExpiresAt` |
| `CANCELLATION` | Set `premiumExpiresAt` (subscription stays active until period end; do NOT flip `isPremium` to false yet) |
| `EXPIRATION` | Set `isPremium: false`, clear `premiumExpiresAt` |
| `BILLING_ISSUE` | Set `isPremium: false` |
| `REFUND` | Set `isPremium: false` |
| All others | Log and return `200` (ignore) |

The `app_user_id` in the RevenueCat event payload is the Cognito `sub` (set via `SubscriptionService.logIn(userId)`). This is used as the DynamoDB PK to find and update the user record.

### 6.3 CDK Stack Updates (`swara-stack.ts`)

- New Lambda function: `WebhookHandler` (same Node 22 ARM64 pattern as existing handlers)
- New API Gateway route: `POST /api/webhooks/revenuecat` → `WebhookHandler` (no JWT authorizer)
- New SSM/Secrets Manager parameter: `REVENUECAT_WEBHOOK_SECRET`
- Grant `WebhookHandler` `dynamodb:UpdateItem` on the users table

---

## 7. Analytics

Wire the existing stub methods in `AnalyticsService` to real purchase events:

| Stub method | Trigger |
|-------------|---------|
| `logPurchaseInitiated` | User taps Subscribe in paywall modal |
| `logPurchaseCompleted` | `SubscriptionService.purchase()` resolves successfully |
| `logPurchaseFailed` | `SubscriptionService.purchase()` throws (excluding user-cancelled) |

Also set `subscription_tier: isPremium ? 'paid' : 'free'` on the Firebase Analytics user properties after each entitlement state change (replaces the hardcoded `'free'` in `profile.page.ts`).

---

## 8. Files Affected

### New files
| File | Purpose |
|------|---------|
| `libs/subscription/src/index.ts` | Barrel export |
| `libs/subscription/src/lib/subscription.service.ts` | RevenueCat wrapper |
| `libs/subscription/project.json` | Nx project config (follows same pattern as `libs/auth/project.json` — `@nx/js:tsc` build target, `@nx/eslint:lint` target) |
| `apps/mobile-app/src/app/shared/components/paywall-modal/paywall-modal.component.ts` | Paywall modal |
| `apps/mobile-app/src/app/pages/tune/tune.page.ts` | Tune hub page |
| `apps/mobile-app/src/app/pages/tune/guitar-tuner/guitar-tuner.page.ts` | Guitar tuner page |
| `apps/mobile-app/src/app/pages/tune/violin-tuner/violin-tuner.page.ts` | Violin tuner page |
| `apps/backend-api/src/handlers/webhook.handler.ts` | RevenueCat webhook Lambda |

### Modified files
| File | Change |
|------|--------|
| `apps/mobile-app/src/app/tabs/tabs.component.ts` | Remove Tanpura tab, add Tune tab |
| `apps/mobile-app/src/app/app.routes.ts` | Add `/tune`, `/tune/guitar`, `/tune/violin` routes; keep `/tanpura` route |
| `apps/mobile-app/src/app/app.config.ts` | Initialize `SubscriptionService` on boot |
| `apps/mobile-app/src/environments/environment.ts` | Add `revenueCat` keys |
| `apps/mobile-app/src/environments/environment.prod.ts` | Add `revenueCat` keys |
| `apps/mobile-app/src/app/core/services/analytics.service.ts` | Wire purchase stubs; update subscription_tier property |
| `apps/mobile-app/src/app/pages/profile/profile.page.ts` | Remove hardcoded `subscription_tier: 'free'` |
| `apps/backend-api/src/handlers/users.handler.ts` | Add `isPremium`, `premiumSince`, `premiumExpiresAt` to `UserProfile` type |
| `apps/infra/lib/swara-stack.ts` | Add WebhookHandler Lambda + route + secret |
| `tsconfig.base.json` | Add `@swara/subscription` path alias |
| `package.json` | Add `@revenuecat/purchases-capacitor` dependency |

---

## 9. Out of Scope

- Pricing UI A/B testing (can be done via RevenueCat offerings without code changes)
- Server-side feature gating using `isPremium` from DynamoDB (the app gates client-side; backend `isPremium` is available for future use)
- Western-scale tuning modes for guitar/violin
- Free trial
- Promotional offers or introductory pricing
- Admin tooling to manually grant/revoke premium

---

## 10. Open Questions (resolved)

| Question | Decision |
|----------|----------|
| IAP vs Stripe vs PWA | RevenueCat native IAP — required for App Store/Play Store |
| Subscription model | Single tier: monthly + annual |
| Free trial | None |
| Feature gate style | Soft gate — pages visible, paywall fires on mic activation |
| Tanpura navigation | Moved to Home quick action card; tab removed |
| Tuner placement | New Tune tab (5th tab) |
| Guitar tuning system | Indian-scale (Sa-relative), not standard EADGBE |
| Violin tuning system | Indian-scale Pa-Sa-Pa-Sa |
