# Premium Launch Checklist

Manual setup steps required before the premium subscription feature goes live.
Code is complete — these are store, dashboard, and infrastructure steps only.

---

## 1. App Store Connect (Apple)

- [ ] Create a new **Subscription Group** named `Swara Premium`
- [ ] Add product `swara_premium_monthly` — price tier $1.99/month
  - [ ] Set **3-day free trial** on this product
- [ ] Add product `swara_premium_annual` — price tier $14.99/year
  - [ ] Set **3-day free trial** on this product
- [ ] Submit both products for review alongside the next app build

---

## 2. Google Play Console

- [ ] Create a new **Subscription** for Swara AI
- [ ] Add base plan `swara_premium_monthly` — $1.99/month
  - [ ] Set **3-day free trial**
- [ ] Add base plan `swara_premium_annual` — $14.99/year
  - [ ] Set **3-day free trial**
- [ ] Activate both base plans

---

## 3. RevenueCat Dashboard

- [ ] Create a new RevenueCat project for Swara AI
- [ ] Add the iOS app (link to App Store Connect)
- [ ] Add the Android app (link to Google Play Console)
- [ ] Create **Entitlement** with identifier: `premium`
  - [ ] Attach both products (`swara_premium_monthly`, `swara_premium_annual`) to this entitlement
- [ ] Create **Offering** with identifier: `default`
  - [ ] Add `monthly` package pointing to `swara_premium_monthly`
  - [ ] Add `annual` package pointing to `swara_premium_annual`
- [ ] Note down the **Apple API Key** and **Google API Key** from the RevenueCat dashboard

---

## 4. App Environment Keys

- [ ] Replace placeholder keys in `apps/mobile-app/src/environments/environment.ts`:
  ```
  appleApiKey: 'appl_REPLACE_WITH_DEV_KEY'   →  real dev key from RevenueCat
  googleApiKey: 'goog_REPLACE_WITH_DEV_KEY'  →  real dev key from RevenueCat
  ```
- [ ] Replace placeholder keys in `apps/mobile-app/src/environments/environment.prod.ts`:
  ```
  appleApiKey: 'appl_REPLACE_WITH_PROD_KEY'  →  real prod key from RevenueCat
  googleApiKey: 'goog_REPLACE_WITH_PROD_KEY' →  real prod key from RevenueCat
  ```

---

## 5. AWS Infrastructure

- [ ] Deploy the CDK stack: `pnpm nx run infra:deploy-prod`
- [ ] After deploy, go to **AWS Secrets Manager** in the AWS console (ap-south-1)
- [ ] Find the secret named `swara-prod-revenuecat-webhook-secret`
- [ ] Set its value to the **webhook shared secret** from the RevenueCat dashboard
  (RevenueCat dashboard → Project Settings → Webhooks → show secret)

---

## 6. RevenueCat Webhook

- [ ] In RevenueCat dashboard → Project Settings → Webhooks
- [ ] Add webhook URL: `https://{your-api-gateway-url}/v1/api/webhooks/revenuecat`
  (get the API Gateway URL from CDK outputs after deploy)
- [ ] Set the shared secret to match what you stored in AWS Secrets Manager (step 5)
- [ ] Send a test event and verify the webhook Lambda responds with `200 OK`
  (check CloudWatch logs for `RevenueCat webhook: type=TEST`)

---

## 7. Smoke Test (Sandbox)

- [ ] Build and install the app on a real device (TestFlight / Internal track)
- [ ] Open the Tune tab — verify Guitar and Violin tuner cards appear with Premium badge
- [ ] Tap a tuner card — verify paywall modal opens with correct pricing
- [ ] Complete a sandbox purchase — verify the tuner activates after purchase
- [ ] Kill and reopen the app — verify premium state is restored (RevenueCat caches entitlements)
- [ ] Check the `swara-users` DynamoDB table — verify `isPremium: true` was written by the webhook
- [ ] Test Restore Purchases on a second device with the same sandbox account

---

*Generated: 2026-06-19*
