# Premium Tuners & Subscription Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add RevenueCat IAP subscription gating, an Indian-scale guitar tuner, and an Indian-scale violin tuner behind a paid premium tier, while restructuring navigation to replace the Tanpura tab with a new Tune tab.

**Architecture:** A new `libs/subscription` Angular library wraps the RevenueCat Capacitor SDK and exposes an `isPremium` signal. Two new tuner pages live under a `/tune` hub route and gate microphone access behind that signal. A new backend webhook Lambda receives RevenueCat purchase events and writes `isPremium` to the DynamoDB users table.

**Tech Stack:** `@revenuecat/purchases-capacitor`, Angular Signals, Ionic modals, AWS Lambda (Node 22 ARM64), AWS CDK v2, DynamoDB `UpdateItem`.

**Spec:** `docs/superpowers/specs/2026-06-17-premium-tuners-design.md`

---

## Phase 1 — Navigation Restructure

### Task 1: Remove Tanpura tab, add Tune tab

**Files:**
- Modify: `apps/mobile-app/src/app/tabs/tabs.component.ts`

- [ ] **Step 1: Update tabs.component.ts**

Replace the entire file content:

```typescript
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, home,
  micOutline, mic,
  barbellOutline, barbell,
  optionsOutline, options,
  personOutline, person
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, RouterLink],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="swara-tab-bar">
        <ion-tab-button tab="home" [routerLink]="['/home']">
          <ion-icon name="home-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="sing" [routerLink]="['/sing']" class="tab-center">
          <ion-icon name="mic-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="practice" [routerLink]="['/practice']">
          <ion-icon name="barbell-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="tune" [routerLink]="['/tune']">
          <ion-icon name="options-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="profile" [routerLink]="['/profile']">
          <ion-icon name="person-outline"></ion-icon>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
  private readonly _icons = (() => addIcons({
    homeOutline, home,
    micOutline, mic,
    barbellOutline, barbell,
    optionsOutline, options,
    personOutline, person
  }))();
}
```

- [ ] **Step 2: Add tune routes to app.routes.ts**

Open `apps/mobile-app/src/app/app.routes.ts`. Inside the `children` array (after the `practice` route and before the `progress` route), add:

```typescript
      {
        path: 'tune',
        loadComponent: () => import('./pages/tune/tune.page').then(m => m.TunePage)
      },
      {
        path: 'tune/guitar',
        loadComponent: () => import('./pages/tune/guitar-tuner/guitar-tuner.page').then(m => m.GuitarTunerPage)
      },
      {
        path: 'tune/violin',
        loadComponent: () => import('./pages/tune/violin-tuner/violin-tuner.page').then(m => m.ViolinTunerPage)
      },
```

Also add `tune` to the `SCREEN_NAMES` map in `apps/mobile-app/src/app/app.config.ts`:

```typescript
const SCREEN_NAMES: Record<string, string> = {
  home:     'Home',
  tanpura:  'Tanpura',
  sing:     'Sing',
  practice: 'Practice',
  tune:     'Tune',           // add this line
  progress: 'Progress',
  settings: 'Settings',
  profile:  'Profile',
  // ... rest unchanged
};
```

- [ ] **Step 3: Create placeholder tune pages so the app compiles**

Create `apps/mobile-app/src/app/pages/tune/tune.page.ts`:

```typescript
import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-tune',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Tune</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content><!-- placeholder --></ion-content>
  `
})
export class TunePage {}
```

Create `apps/mobile-app/src/app/pages/tune/guitar-tuner/guitar-tuner.page.ts`:

```typescript
import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-guitar-tuner',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Guitar Tuner</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content><!-- placeholder --></ion-content>
  `
})
export class GuitarTunerPage {}
```

Create `apps/mobile-app/src/app/pages/tune/violin-tuner/violin-tuner.page.ts`:

```typescript
import { Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-violin-tuner',
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Violin Tuner</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content><!-- placeholder --></ion-content>
  `
})
export class ViolinTunerPage {}
```

- [ ] **Step 4: Verify the app builds**

```bash
pnpm nx build mobile-app
```

Expected: build completes with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile-app/src/app/tabs/tabs.component.ts \
        apps/mobile-app/src/app/app.routes.ts \
        apps/mobile-app/src/app/app.config.ts \
        apps/mobile-app/src/app/pages/tune/
git commit -m "feat: replace tanpura tab with tune tab, add placeholder tune pages"
```

---

## Phase 2 — Subscription Library

### Task 2: Install RevenueCat SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
pnpm add @revenuecat/purchases-capacitor
```

Expected: package added to `node_modules`, `pnpm-lock.yaml` updated.

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add @revenuecat/purchases-capacitor"
```

---

### Task 3: Create libs/subscription library

**Files:**
- Create: `libs/subscription/project.json`
- Create: `libs/subscription/src/index.ts`
- Create: `libs/subscription/src/lib/subscription.service.ts`
- Modify: `tsconfig.base.json`

- [ ] **Step 1: Create the Nx project config**

Create `libs/subscription/project.json`:

```json
{
  "name": "subscription",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/subscription/src",
  "projectType": "library",
  "tags": ["scope:mobile", "type:data-access"],
  "targets": {
    "lint": {
      "executor": "@nx/eslint:lint",
      "outputs": ["{options.outputFile}"],
      "options": { "lintFilePatterns": ["libs/subscription/**/*.ts"] }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "outputs": ["{workspaceRoot}/coverage/{projectRoot}"],
      "options": { "jestConfig": "libs/subscription/jest.config.ts" }
    }
  }
}
```

- [ ] **Step 2: Create jest config**

Create `libs/subscription/jest.config.ts`:

```typescript
export default {
  displayName: 'subscription',
  preset: '../../jest.preset.js',
  setupFiles: ['<rootDir>/src/test-setup.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }]
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/subscription'
};
```

- [ ] **Step 3: Add path alias to tsconfig.base.json**

In `tsconfig.base.json`, inside `"paths"`, add after the last existing entry:

```json
      "@voice-tuner/subscription": ["libs/subscription/src/index.ts"]
```

- [ ] **Step 4: Write the SubscriptionService**

Create `libs/subscription/src/lib/subscription.service.ts`:

```typescript
import { Injectable, signal, computed } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  type CustomerInfo,
  type Offerings,
  type Package,
  LOG_LEVEL,
} from '@revenuecat/purchases-capacitor';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly _isPremium = signal<boolean>(false);
  private readonly _initialized = signal<boolean>(false);

  /** Synchronous signal read — safe in templates and guards. */
  readonly isPremium = this._isPremium.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  /** Observable adapter for reactive pipelines. */
  readonly isPremium$: Observable<boolean> = toObservable(this._isPremium);

  /**
   * Call once at app boot (APP_INITIALIZER) with the platform-specific
   * RevenueCat public API key.
   */
  async initialize(appleApiKey: string, googleApiKey: string): Promise<void> {
    const apiKey = Capacitor.getPlatform() === 'ios' ? appleApiKey : googleApiKey;

    await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey });

    // Sync current entitlement state immediately
    const { customerInfo } = await Purchases.getCustomerInfo();
    this._updateFromCustomerInfo(customerInfo);

    // Listen for background changes (renewals, expirations, etc.)
    await Purchases.addCustomerInfoUpdateListener(({ customerInfo: info }) => {
      this._updateFromCustomerInfo(info);
    });

    this._initialized.set(true);
  }

  /**
   * Associate RevenueCat purchases with the authenticated Cognito user.
   * Call after a successful sign-in.
   */
  async logIn(userId: string): Promise<void> {
    const { customerInfo } = await Purchases.logIn({ appUserID: userId });
    this._updateFromCustomerInfo(customerInfo);
  }

  /**
   * Disassociate the user — switches RevenueCat to an anonymous ID.
   * Call on sign-out.
   */
  async logOut(): Promise<void> {
    await Purchases.logOut();
    this._isPremium.set(false);
  }

  /**
   * Fetch the current RevenueCat offering (cached after first call).
   * Returns null if the network call fails.
   */
  async getOfferings(): Promise<Offerings | null> {
    try {
      const { offerings } = await Purchases.getOfferings();
      return offerings;
    } catch {
      return null;
    }
  }

  /**
   * Trigger the native App Store / Google Play purchase sheet.
   * Throws PurchasesError on failure; throws with `userCancelled: true` if dismissed.
   */
  async purchase(rcPackage: Package): Promise<void> {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: rcPackage });
    this._updateFromCustomerInfo(customerInfo);
  }

  /**
   * Restore previous purchases (required by App Store guidelines).
   * Updates isPremium if an active entitlement is found.
   */
  async restorePurchases(): Promise<void> {
    const { customerInfo } = await Purchases.restorePurchases();
    this._updateFromCustomerInfo(customerInfo);
  }

  private _updateFromCustomerInfo(info: CustomerInfo): void {
    const hasPremium = info.entitlements.active['premium'] !== undefined;
    this._isPremium.set(hasPremium);
  }
}
```

- [ ] **Step 5: Create the barrel export**

Create `libs/subscription/src/index.ts`:

```typescript
export * from './lib/subscription.service';
```

- [ ] **Step 6: Verify the library compiles**

```bash
pnpm nx lint subscription
```

Expected: no lint errors.

- [ ] **Step 7: Commit**

```bash
git add libs/subscription/ tsconfig.base.json
git commit -m "feat: add SubscriptionService wrapping RevenueCat Capacitor SDK"
```

---

### Task 4: Add RevenueCat keys to environment files

**Files:**
- Modify: `apps/mobile-app/src/environments/environment.ts`
- Modify: `apps/mobile-app/src/environments/environment.prod.ts`

- [ ] **Step 1: Update environment.ts (dev)**

In `apps/mobile-app/src/environments/environment.ts`, add the `revenueCat` block after the `firebase` block:

```typescript
  revenueCat: {
    appleApiKey: 'appl_REPLACE_WITH_DEV_KEY',
    googleApiKey: 'goog_REPLACE_WITH_DEV_KEY',
  },
```

- [ ] **Step 2: Update environment.prod.ts**

In `apps/mobile-app/src/environments/environment.prod.ts`, add the same block with production keys:

```typescript
  revenueCat: {
    appleApiKey: 'appl_REPLACE_WITH_PROD_KEY',
    googleApiKey: 'goog_REPLACE_WITH_PROD_KEY',
  },
```

> **Note:** Replace `REPLACE_WITH_DEV_KEY` / `REPLACE_WITH_PROD_KEY` with real keys from the RevenueCat dashboard once the app is registered there. Until then the app will fail to initialize RevenueCat at runtime but will still compile.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/environments/
git commit -m "chore: add revenueCat api key placeholders to environment files"
```

---

### Task 5: Initialize SubscriptionService at app boot

**Files:**
- Modify: `apps/mobile-app/src/app/app.config.ts`

- [ ] **Step 1: Add SubscriptionService initializer**

In `apps/mobile-app/src/app/app.config.ts`, add the import at the top:

```typescript
import { SubscriptionService } from '@voice-tuner/subscription';
import { environment } from '../environments/environment';
```

Then add a new `APP_INITIALIZER` entry in the `providers` array, after the existing analytics initializer:

```typescript
    // Subscription: initialize RevenueCat on app boot
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const subscription = inject(SubscriptionService);
        return () => subscription.initialize(
          environment.revenueCat.appleApiKey,
          environment.revenueCat.googleApiKey
        );
      },
      multi: true,
    },
```

- [ ] **Step 2: Wire logIn / logOut into AuthService**

Open `libs/auth/src/lib/auth.service.ts`. The `signIn` and `signOut` methods need to call into `SubscriptionService`. However, injecting `SubscriptionService` directly into `AuthService` would create a circular dependency risk. Instead, wire it in `app.config.ts` by subscribing to `AuthService.user$` changes.

Add the following function to `app.config.ts` (before `appConfig`):

```typescript
function subscriptionAuthSyncInitializer(
  auth: AuthService,
  subscription: SubscriptionService,
): () => void {
  return () => {
    auth.user$.subscribe(user => {
      if (user) {
        subscription.logIn(user.id).catch(console.error);
      } else {
        subscription.logOut().catch(console.error);
      }
    });
  };
}
```

Add the corresponding import:
```typescript
import { AuthService } from '@voice-tuner/auth';
```

Add the new `APP_INITIALIZER` entry in `providers`:

```typescript
    // Subscription: sync RevenueCat login state with Cognito auth state
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const auth = inject(AuthService);
        const subscription = inject(SubscriptionService);
        return subscriptionAuthSyncInitializer(auth, subscription);
      },
      multi: true,
    },
```

- [ ] **Step 3: Build to verify no compile errors**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-app/src/app/app.config.ts
git commit -m "feat: initialize RevenueCat and sync auth state on app boot"
```

---

## Phase 3 — Paywall Modal

### Task 6: Build the PaywallModalComponent

**Files:**
- Create: `apps/mobile-app/src/app/shared/components/paywall-modal/paywall-modal.component.ts`

- [ ] **Step 1: Create the paywall modal component**

Create `apps/mobile-app/src/app/shared/components/paywall-modal/paywall-modal.component.ts`:

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
  IonIcon, IonSpinner, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SubscriptionService } from '@voice-tuner/subscription';
import { AnalyticsService } from '../../../core/services/analytics.service';
import type { Offerings, Package } from '@revenuecat/purchases-capacitor';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-paywall-modal',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonButton, IonIcon, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="paywall-content">

      <!-- Header -->
      <div class="paywall-hero">
        <h1>Unlock Swara Premium</h1>
        <p>Tune your instruments the Indian classical way</p>
      </div>

      <!-- Feature list -->
      <ul class="feature-list">
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          Indian-scale Guitar Tuner (Sa-relative)
        </li>
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          Indian-scale Violin Tuner (Pa-Sa-Pa-Sa)
        </li>
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          All future premium features
        </li>
      </ul>

      <!-- Loading state -->
      @if (loadState() === 'loading') {
        <div class="loading-state">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      }

      <!-- Error state -->
      @if (loadState() === 'error') {
        <div class="error-state">
          <p>Could not load pricing. Check your connection.</p>
          <ion-button fill="outline" (click)="loadOfferings()">Try Again</ion-button>
        </div>
      }

      <!-- Pricing cards -->
      @if (loadState() === 'ready') {
        <div class="pricing-cards">
          @for (pkg of packages(); track pkg.identifier) {
            <div
              class="pricing-card"
              [class.selected]="selectedPackage()?.identifier === pkg.identifier"
              (click)="selectPackage(pkg)"
            >
              @if (pkg.packageType === 'ANNUAL') {
                <span class="savings-badge">Save 37%</span>
              }
              <div class="pkg-title">{{ pkg.product.title }}</div>
              <div class="pkg-price">
                @if (pkg.product.introPrice) {
                  <span class="trial-label">3 days free, then</span>
                }
                {{ pkg.product.priceString }}
                <span class="pkg-period">/ {{ pkg.packageType === 'MONTHLY' ? 'month' : 'year' }}</span>
              </div>
            </div>
          }
        </div>

        <!-- CTA -->
        <ion-button
          expand="block"
          class="subscribe-btn"
          [disabled]="subscribing()"
          (click)="subscribe()"
        >
          @if (subscribing()) {
            <ion-spinner name="crescent" slot="start"></ion-spinner>
            Processing...
          } @else if (selectedPackage()?.product?.introPrice) {
            Start 3-Day Free Trial
          } @else {
            Subscribe Now
          }
        </ion-button>
      }

      <!-- Footer -->
      <div class="paywall-footer">
        <button class="restore-btn" (click)="restore()">Restore Purchases</button>
        <p class="legal">Cancel anytime. Managed by Apple / Google.</p>
      </div>

    </ion-content>
  `,
  styles: [`
    .paywall-hero { text-align: center; padding: 24px 16px 8px; }
    .paywall-hero h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 8px; }
    .feature-list { list-style: none; padding: 0 24px; margin: 16px 0; }
    .feature-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .pricing-cards { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .pricing-card { border: 2px solid var(--ion-color-medium); border-radius: 12px; padding: 16px; position: relative; cursor: pointer; }
    .pricing-card.selected { border-color: var(--swara-primary); }
    .savings-badge { position: absolute; top: -10px; right: 12px; background: var(--swara-secondary); color: #000; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    .pkg-title { font-weight: 600; margin-bottom: 4px; }
    .pkg-price { font-size: 1.2rem; font-weight: 700; }
    .pkg-period { font-size: 0.85rem; font-weight: 400; color: var(--ion-color-medium); }
    .trial-label { display: block; font-size: 0.75rem; font-weight: 400; color: var(--swara-secondary); }
    .subscribe-btn { margin: 8px 16px; }
    .loading-state, .error-state { display: flex; flex-direction: column; align-items: center; padding: 32px; gap: 16px; }
    .paywall-footer { text-align: center; padding: 16px; }
    .restore-btn { background: none; border: none; color: var(--ion-color-medium); font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
    .legal { font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 8px; }
  `]
})
export class PaywallModalComponent implements OnInit {
  readonly loadState = signal<LoadState>('loading');
  readonly packages = signal<Package[]>([]);
  readonly selectedPackage = signal<Package | null>(null);
  readonly subscribing = signal<boolean>(false);

  constructor(
    private modalCtrl: ModalController,
    private subscriptionService: SubscriptionService,
    private analytics: AnalyticsService,
  ) {
    addIcons({ closeOutline, checkmarkCircleOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.loadOfferings();
  }

  async loadOfferings(): Promise<void> {
    this.loadState.set('loading');
    const offerings = await this.subscriptionService.getOfferings();
    if (!offerings?.current) {
      this.loadState.set('error');
      return;
    }
    const pkgs = offerings.current.availablePackages;
    this.packages.set(pkgs);
    // Default: select annual if available, otherwise monthly
    const annual = pkgs.find(p => p.packageType === 'ANNUAL');
    this.selectedPackage.set(annual ?? pkgs[0] ?? null);
    this.loadState.set('ready');
  }

  selectPackage(pkg: Package): void {
    this.selectedPackage.set(pkg);
  }

  async subscribe(): Promise<void> {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    this.analytics.logPurchaseInitiated(
      pkg.product.identifier,
      pkg.product.price,
      pkg.product.currencyCode
    );
    this.subscribing.set(true);

    try {
      await this.subscriptionService.purchase(pkg);
      this.analytics.logPurchaseCompleted(
        pkg.product.identifier,
        pkg.product.price,
        pkg.product.currencyCode
      );
      await this.modalCtrl.dismiss(null, 'purchased');
    } catch (err: unknown) {
      const cancelled = (err as { userCancelled?: boolean })?.userCancelled;
      if (!cancelled) {
        this.analytics.logPurchaseFailed(
          pkg.product.identifier,
          String(err)
        );
      }
    } finally {
      this.subscribing.set(false);
    }
  }

  async restore(): Promise<void> {
    await this.subscriptionService.restorePurchases();
    if (this.subscriptionService.isPremium()) {
      await this.modalCtrl.dismiss(null, 'purchased');
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancelled');
  }
}
```

- [ ] **Step 2: Update AnalyticsService stubs to accept parameters**

Open `apps/mobile-app/src/app/core/services/analytics.service.ts`. Find the three stub methods and update their signatures so the paywall modal can pass product data:

```typescript
  logPurchaseInitiated(productId: string, price: number, currency: string): void {
    this.logEvent('purchase_initiated', { product_id: productId, price, currency });
  }

  logPurchaseCompleted(productId: string, price: number, currency: string): void {
    this.logEvent('purchase_completed', { product_id: productId, price, currency });
  }

  logPurchaseFailed(productId: string, error: string): void {
    this.logEvent('purchase_failed', { product_id: productId, error });
  }
```

- [ ] **Step 3: Build to verify**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile-app/src/app/shared/components/paywall-modal/ \
        apps/mobile-app/src/app/core/services/analytics.service.ts
git commit -m "feat: add PaywallModalComponent with RevenueCat offerings and purchase flow"
```

---

## Phase 4 — Tune Hub Page

### Task 7: Build the Tune hub page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/tune/tune.page.ts`

- [ ] **Step 1: Replace placeholder with full hub implementation**

Replace `apps/mobile-app/src/app/pages/tune/tune.page.ts`:

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, chevronForwardOutline } from 'ionicons/icons';
import { SubscriptionService } from '@voice-tuner/subscription';

interface TunerCard {
  title: string;
  subtitle: string;
  route: string;
  description: string;
}

@Component({
  selector: 'app-tune',
  standalone: true,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonIcon],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Tune</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="tune-content">
      <div class="tune-hero">
        <h2>Instrument Tuners</h2>
        <p>Tune your instruments relative to your Sa</p>
      </div>

      <div class="tuner-cards">
        @for (card of tunerCards; track card.route) {
          <div class="tuner-card" (click)="navigate(card.route)">
            <div class="card-body">
              <div class="card-text">
                <h3>{{ card.title }}</h3>
                <p>{{ card.description }}</p>
              </div>
              <div class="card-action">
                @if (!isPremium()) {
                  <ion-icon name="lock-closed-outline" class="lock-icon"></ion-icon>
                } @else {
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                }
              </div>
            </div>
            @if (!isPremium()) {
              <span class="premium-badge">Premium</span>
            }
          </div>
        }
      </div>

      @if (!isPremium()) {
        <p class="upgrade-hint">
          Subscribe to unlock all tuners
        </p>
      }
    </ion-content>
  `,
  styles: [`
    .tune-hero { padding: 24px 16px 8px; }
    .tune-hero h2 { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
    .tuner-cards { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .tuner-card { background: var(--swara-surface); border-radius: 16px; padding: 20px; position: relative; cursor: pointer; }
    .card-body { display: flex; align-items: center; justify-content: space-between; }
    .card-text h3 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 600; }
    .card-text p { margin: 0; font-size: 0.85rem; color: var(--ion-color-medium); }
    .lock-icon { color: var(--swara-accent); font-size: 1.4rem; }
    .premium-badge { position: absolute; top: 12px; right: 12px; background: var(--swara-accent); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    .upgrade-hint { text-align: center; color: var(--ion-color-medium); font-size: 0.85rem; padding: 8px 16px 24px; }
  `]
})
export class TunePage {
  readonly isPremium = this.subscriptionService.isPremium;

  readonly tunerCards: TunerCard[] = [
    {
      title: 'Guitar Tuner',
      subtitle: 'Indian scale',
      route: '/tune/guitar',
      description: 'Sa-Pa-Sa-Ma-Sa-Pa tuning relative to your key',
    },
    {
      title: 'Violin Tuner',
      subtitle: 'Indian scale',
      route: '/tune/violin',
      description: 'Pa-Sa-Pa-Sa tuning for Indian classical violin',
    },
  ];

  constructor(
    private subscriptionService: SubscriptionService,
    private router: Router,
  ) {
    addIcons({ lockClosedOutline, chevronForwardOutline });
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/tune/tune.page.ts
git commit -m "feat: implement Tune hub page with premium instrument cards"
```

---

## Phase 5 — Guitar Tuner Page

### Task 8: Build the Guitar Tuner page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/tune/guitar-tuner/guitar-tuner.page.ts`

- [ ] **Step 1: Replace placeholder with full guitar tuner implementation**

Replace `apps/mobile-app/src/app/pages/tune/guitar-tuner/guitar-tuner.page.ts`:

```typescript
import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonIcon, IonBackButton, IonButtons,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { micOutline, micOffOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AudioEngineService } from '@voice-tuner/audio-engine';
import { PitchDetectionService } from '@voice-tuner/pitch-detection';
import { SubscriptionService } from '@voice-tuner/subscription';
import { PaywallModalComponent } from '../../../shared/components/paywall-modal/paywall-modal.component';

interface GuitarString {
  label: string;         // e.g. "String 6"
  indianName: string;    // e.g. "Sa"
  semitonesFromSa: number;
}

const GUITAR_STRINGS: GuitarString[] = [
  { label: 'String 6', indianName: 'Sa',  semitonesFromSa: -24 },
  { label: 'String 5', indianName: 'Pa',  semitonesFromSa: -17 },
  { label: 'String 4', indianName: 'Sa',  semitonesFromSa: -12 },
  { label: 'String 3', indianName: 'Ma',  semitonesFromSa:  -5 },
  { label: 'String 2', indianName: 'Sa',  semitonesFromSa:   0 },
  { label: 'String 1', indianName: 'Pa',  semitonesFromSa:   7 },
];

@Component({
  selector: 'app-guitar-tuner',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonIcon, IonBackButton, IonButtons,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tune"></ion-back-button>
        </ion-buttons>
        <ion-title>Guitar Tuner</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="tuner-content">

      <!-- Sa display -->
      <div class="sa-display">
        Sa = {{ saNoteName() }}
      </div>

      <!-- String selector -->
      <div class="string-selector">
        @for (str of strings; track str.label; let i = $index) {
          <button
            class="string-btn"
            [class.active]="activeStringIndex() === i"
            (click)="selectString(i)"
          >
            <span class="string-indian">{{ str.indianName }}</span>
            <span class="string-label">{{ str.label }}</span>
          </button>
        }
      </div>

      <!-- Gauge -->
      <div class="gauge-container">
        <div class="gauge">
          <div class="gauge-track">
            <div
              class="gauge-needle"
              [style.left.%]="needlePosition()"
              [class.in-tune]="isInTune()"
            ></div>
          </div>
          <div class="gauge-labels">
            <span>-50¢</span>
            <span>0</span>
            <span>+50¢</span>
          </div>
        </div>
        <div class="cents-display" [class.in-tune]="isInTune()">
          {{ centsDisplay() }}
        </div>
        <div class="note-display">{{ detectedNote() }}</div>
      </div>

      <!-- Mic toggle -->
      <ion-button expand="block" class="mic-btn" (click)="toggleMic()">
        <ion-icon [name]="micActive() ? 'mic-outline' : 'mic-off-outline'" slot="start"></ion-icon>
        {{ micActive() ? 'Listening...' : 'Start Tuner' }}
      </ion-button>

    </ion-content>
  `,
  styles: [`
    .sa-display { text-align: center; padding: 12px; font-size: 0.9rem; color: var(--ion-color-medium); }
    .string-selector { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; }
    .string-btn { flex-shrink: 0; background: var(--swara-surface); border: 2px solid transparent; border-radius: 10px; padding: 10px 14px; text-align: center; cursor: pointer; color: var(--ion-text-color); }
    .string-btn.active { border-color: var(--swara-primary); }
    .string-indian { display: block; font-weight: 700; font-size: 1rem; }
    .string-label { display: block; font-size: 0.7rem; color: var(--ion-color-medium); }
    .gauge-container { padding: 32px 24px; }
    .gauge-track { height: 8px; background: linear-gradient(to right, var(--ion-color-danger), var(--ion-color-warning), var(--ion-color-success), var(--ion-color-warning), var(--ion-color-danger)); border-radius: 4px; position: relative; }
    .gauge-needle { position: absolute; top: -8px; width: 4px; height: 24px; background: white; border-radius: 2px; transform: translateX(-50%); transition: left 0.1s ease; }
    .gauge-needle.in-tune { background: var(--ion-color-success); box-shadow: 0 0 8px var(--ion-color-success); }
    .gauge-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 6px; }
    .cents-display { text-align: center; font-size: 2rem; font-weight: 700; margin-top: 24px; }
    .cents-display.in-tune { color: var(--ion-color-success); }
    .note-display { text-align: center; font-size: 0.9rem; color: var(--ion-color-medium); margin-top: 4px; }
    .mic-btn { margin: 24px 16px; }
  `]
})
export class GuitarTunerPage implements OnDestroy {
  readonly strings = GUITAR_STRINGS;

  readonly activeStringIndex = signal<number>(4); // default: String 2 = Sa
  readonly micActive = signal<boolean>(false);
  readonly centsDisplay = signal<string>('—');
  readonly needlePosition = signal<number>(50); // 0-100%, 50 = centre
  readonly isInTune = signal<boolean>(false);
  readonly detectedNote = signal<string>('');
  readonly saNoteName = signal<string>('C');

  private pitchSub: Subscription | null = null;
  private saFrequency = 261.63; // C4 default

  constructor(
    private audioEngine: AudioEngineService,
    private pitchDetection: PitchDetectionService,
    private subscriptionService: SubscriptionService,
    private modalCtrl: ModalController,
  ) {
    addIcons({ micOutline, micOffOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.subscriptionService.isPremium()) {
      const modal = await this.modalCtrl.create({
        component: PaywallModalComponent,
        cssClass: 'paywall-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'purchased') {
        await this.startTuner();
      }
      return;
    }
    await this.startTuner();
  }

  ionViewWillLeave(): void {
    this.stopTuner();
  }

  ngOnDestroy(): void {
    this.stopTuner();
  }

  selectString(index: number): void {
    this.activeStringIndex.set(index);
    // Reset gauge when switching strings
    this.centsDisplay.set('—');
    this.needlePosition.set(50);
    this.isInTune.set(false);
  }

  async toggleMic(): Promise<void> {
    if (this.micActive()) {
      this.stopTuner();
    } else {
      await this.startTuner();
    }
  }

  private async startTuner(): Promise<void> {
    await this.audioEngine.initialize();
    await this.audioEngine.enableMicrophone();
    this.micActive.set(true);

    this.pitchSub = this.pitchDetection.smoothPitch$.subscribe(result => {
      if (!result) return;
      const target = this.targetFrequency();
      const cents = 1200 * Math.log2(result.frequency / target);
      const clamped = Math.max(-50, Math.min(50, cents));
      const position = ((clamped + 50) / 100) * 100; // 0-100%

      this.centsDisplay.set(cents >= 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`);
      this.needlePosition.set(position);
      this.isInTune.set(Math.abs(cents) <= 5);
      this.detectedNote.set(`${result.note}${result.octave} — ${result.frequency.toFixed(1)} Hz`);
    });
  }

  private stopTuner(): void {
    this.pitchSub?.unsubscribe();
    this.pitchSub = null;
    this.audioEngine.disableMicrophone();
    this.micActive.set(false);
  }

  private targetFrequency(): number {
    const semitones = GUITAR_STRINGS[this.activeStringIndex()].semitonesFromSa;
    return this.saFrequency * Math.pow(2, semitones / 12);
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/tune/guitar-tuner/
git commit -m "feat: implement Indian-scale guitar tuner with paywall gate"
```

---

## Phase 6 — Violin Tuner Page

### Task 9: Build the Violin Tuner page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/tune/violin-tuner/violin-tuner.page.ts`

- [ ] **Step 1: Replace placeholder with full violin tuner implementation**

Replace `apps/mobile-app/src/app/pages/tune/violin-tuner/violin-tuner.page.ts`:

```typescript
import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonIcon, IonBackButton, IonButtons,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { micOutline, micOffOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AudioEngineService } from '@voice-tuner/audio-engine';
import { PitchDetectionService } from '@voice-tuner/pitch-detection';
import { SubscriptionService } from '@voice-tuner/subscription';
import { PaywallModalComponent } from '../../../shared/components/paywall-modal/paywall-modal.component';

interface ViolinString {
  label: string;
  indianName: string;
  semitonesFromSa: number;
}

const VIOLIN_STRINGS: ViolinString[] = [
  { label: 'String 4', indianName: 'Pa',  semitonesFromSa: -17 },
  { label: 'String 3', indianName: 'Sa',  semitonesFromSa:   0 },
  { label: 'String 2', indianName: 'Pa',  semitonesFromSa:   7 },
  { label: 'String 1', indianName: 'Sa',  semitonesFromSa:  12 },
];

@Component({
  selector: 'app-violin-tuner',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonIcon, IonBackButton, IonButtons,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tune"></ion-back-button>
        </ion-buttons>
        <ion-title>Violin Tuner</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="tuner-content">

      <div class="sa-display">
        Sa = {{ saNoteName() }} &nbsp;|&nbsp; Pa-Sa-Pa-Sa tuning
      </div>

      <div class="string-selector">
        @for (str of strings; track str.label; let i = $index) {
          <button
            class="string-btn"
            [class.active]="activeStringIndex() === i"
            (click)="selectString(i)"
          >
            <span class="string-indian">{{ str.indianName }}</span>
            <span class="string-label">{{ str.label }}</span>
          </button>
        }
      </div>

      <div class="gauge-container">
        <div class="gauge">
          <div class="gauge-track">
            <div
              class="gauge-needle"
              [style.left.%]="needlePosition()"
              [class.in-tune]="isInTune()"
            ></div>
          </div>
          <div class="gauge-labels">
            <span>-50¢</span>
            <span>0</span>
            <span>+50¢</span>
          </div>
        </div>
        <div class="cents-display" [class.in-tune]="isInTune()">
          {{ centsDisplay() }}
        </div>
        <div class="note-display">{{ detectedNote() }}</div>
      </div>

      <ion-button expand="block" class="mic-btn" (click)="toggleMic()">
        <ion-icon [name]="micActive() ? 'mic-outline' : 'mic-off-outline'" slot="start"></ion-icon>
        {{ micActive() ? 'Listening...' : 'Start Tuner' }}
      </ion-button>

    </ion-content>
  `,
  styles: [`
    .sa-display { text-align: center; padding: 12px; font-size: 0.9rem; color: var(--ion-color-medium); }
    .string-selector { display: flex; gap: 8px; padding: 12px 16px; justify-content: center; }
    .string-btn { background: var(--swara-surface); border: 2px solid transparent; border-radius: 10px; padding: 10px 14px; text-align: center; cursor: pointer; color: var(--ion-text-color); }
    .string-btn.active { border-color: var(--swara-primary); }
    .string-indian { display: block; font-weight: 700; font-size: 1rem; }
    .string-label { display: block; font-size: 0.7rem; color: var(--ion-color-medium); }
    .gauge-container { padding: 32px 24px; }
    .gauge-track { height: 8px; background: linear-gradient(to right, var(--ion-color-danger), var(--ion-color-warning), var(--ion-color-success), var(--ion-color-warning), var(--ion-color-danger)); border-radius: 4px; position: relative; }
    .gauge-needle { position: absolute; top: -8px; width: 4px; height: 24px; background: white; border-radius: 2px; transform: translateX(-50%); transition: left 0.1s ease; }
    .gauge-needle.in-tune { background: var(--ion-color-success); box-shadow: 0 0 8px var(--ion-color-success); }
    .gauge-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 6px; }
    .cents-display { text-align: center; font-size: 2rem; font-weight: 700; margin-top: 24px; }
    .cents-display.in-tune { color: var(--ion-color-success); }
    .note-display { text-align: center; font-size: 0.9rem; color: var(--ion-color-medium); margin-top: 4px; }
    .mic-btn { margin: 24px 16px; }
  `]
})
export class ViolinTunerPage implements OnDestroy {
  readonly strings = VIOLIN_STRINGS;

  readonly activeStringIndex = signal<number>(1); // default: String 3 = Sa
  readonly micActive = signal<boolean>(false);
  readonly centsDisplay = signal<string>('—');
  readonly needlePosition = signal<number>(50);
  readonly isInTune = signal<boolean>(false);
  readonly detectedNote = signal<string>('');
  readonly saNoteName = signal<string>('C');

  private pitchSub: Subscription | null = null;
  private saFrequency = 261.63; // C4 default

  constructor(
    private audioEngine: AudioEngineService,
    private pitchDetection: PitchDetectionService,
    private subscriptionService: SubscriptionService,
    private modalCtrl: ModalController,
  ) {
    addIcons({ micOutline, micOffOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.subscriptionService.isPremium()) {
      const modal = await this.modalCtrl.create({
        component: PaywallModalComponent,
        cssClass: 'paywall-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'purchased') {
        await this.startTuner();
      }
      return;
    }
    await this.startTuner();
  }

  ionViewWillLeave(): void {
    this.stopTuner();
  }

  ngOnDestroy(): void {
    this.stopTuner();
  }

  selectString(index: number): void {
    this.activeStringIndex.set(index);
    this.centsDisplay.set('—');
    this.needlePosition.set(50);
    this.isInTune.set(false);
  }

  async toggleMic(): Promise<void> {
    if (this.micActive()) {
      this.stopTuner();
    } else {
      await this.startTuner();
    }
  }

  private async startTuner(): Promise<void> {
    await this.audioEngine.initialize();
    await this.audioEngine.enableMicrophone();
    this.micActive.set(true);

    this.pitchSub = this.pitchDetection.smoothPitch$.subscribe(result => {
      if (!result) return;
      const target = this.targetFrequency();
      const cents = 1200 * Math.log2(result.frequency / target);
      const clamped = Math.max(-50, Math.min(50, cents));
      const position = ((clamped + 50) / 100) * 100;

      this.centsDisplay.set(cents >= 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`);
      this.needlePosition.set(position);
      this.isInTune.set(Math.abs(cents) <= 5);
      this.detectedNote.set(`${result.note}${result.octave} — ${result.frequency.toFixed(1)} Hz`);
    });
  }

  private stopTuner(): void {
    this.pitchSub?.unsubscribe();
    this.pitchSub = null;
    this.audioEngine.disableMicrophone();
    this.micActive.set(false);
  }

  private targetFrequency(): number {
    const semitones = VIOLIN_STRINGS[this.activeStringIndex()].semitonesFromSa;
    return this.saFrequency * Math.pow(2, semitones / 12);
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/tune/violin-tuner/
git commit -m "feat: implement Indian-scale violin tuner with paywall gate"
```

---

## Phase 7 — Analytics Cleanup

### Task 10: Fix hardcoded subscription_tier in profile page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/profile/profile.page.ts`

- [ ] **Step 1: Inject SubscriptionService and replace hardcode**

In `apps/mobile-app/src/app/pages/profile/profile.page.ts`, add the import:

```typescript
import { SubscriptionService } from '@voice-tuner/subscription';
```

Inject it in the constructor (add alongside existing injected services):

```typescript
private subscriptionService: SubscriptionService
```

Find the `setUserProperties` call (around line 385) and replace:

```typescript
// Before:
subscription_tier: 'free',

// After:
subscription_tier: this.subscriptionService.isPremium() ? 'paid' : 'free',
```

- [ ] **Step 2: Build to verify**

```bash
pnpm nx build mobile-app
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile-app/src/app/pages/profile/profile.page.ts
git commit -m "fix: replace hardcoded subscription_tier 'free' with live isPremium check"
```

---

## Phase 8 — Backend: UserProfile Schema

### Task 11: Add isPremium fields to UserProfile

**Files:**
- Modify: `apps/backend-api/src/handlers/users.handler.ts`

- [ ] **Step 1: Add premium fields to UserProfile interface**

In `apps/backend-api/src/handlers/users.handler.ts`, find the `UserProfile` interface and add three fields:

```typescript
interface UserProfile {
  userId: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
  stats: UserStats;
  favoriteRagas: string[];
  guruCode?: string;
  photoUrl?: string;
  deviceTokens?: DeviceToken[];
  // --- new premium fields ---
  isPremium: boolean;
  premiumSince?: string;
  premiumExpiresAt?: string;
}
```

- [ ] **Step 2: Set isPremium default on user creation**

Find the `PutCommand` used when auto-provisioning a new user on first login (`GET /users/me`). Add `isPremium: false` to the item:

```typescript
isPremium: false,
// premiumSince and premiumExpiresAt omitted (undefined = not set)
```

- [ ] **Step 3: Build backend to verify**

```bash
pnpm nx build backend-api
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/backend-api/src/handlers/users.handler.ts
git commit -m "feat: add isPremium, premiumSince, premiumExpiresAt to UserProfile schema"
```

---

## Phase 9 — Backend: Webhook Lambda

### Task 12: Create the RevenueCat webhook Lambda

**Files:**
- Create: `apps/backend-api/src/handlers/webhook.handler.ts`

- [ ] **Step 1: Create the webhook handler**

Create `apps/backend-api/src/handlers/webhook.handler.ts`:

```typescript
import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE = process.env['USERS_TABLE']!;
const WEBHOOK_SECRET = process.env['REVENUECAT_WEBHOOK_SECRET']!;

/**
 * RevenueCat webhook event shape (partial — only fields we use).
 * Full schema: https://www.revenuecat.com/docs/webhooks
 */
interface RevenueCatEvent {
  type: string;
  app_user_id: string;          // Cognito sub (set via Purchases.logIn)
  expiration_at_ms?: number;    // Unix ms — next renewal or expiry
  purchased_at_ms?: number;     // Unix ms — when the purchase happened
}

interface RevenueCatWebhookBody {
  event: RevenueCatEvent;
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  // Validate shared secret
  const authHeader = event.headers?.['authorization'] ?? '';
  if (authHeader !== WEBHOOK_SECRET) {
    console.warn('RevenueCat webhook: invalid secret');
    return { statusCode: 401, body: 'Unauthorized' };
  }

  let body: RevenueCatWebhookBody;
  try {
    body = JSON.parse(event.body ?? '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  const { type, app_user_id, expiration_at_ms, purchased_at_ms } = body.event;

  if (!app_user_id) {
    return { statusCode: 400, body: 'Missing app_user_id' };
  }

  console.log(`RevenueCat webhook: type=${type} userId=${app_user_id}`);

  try {
    switch (type) {
      case 'INITIAL_PURCHASE':
        await setPremium(app_user_id, true, purchased_at_ms, expiration_at_ms);
        break;

      case 'RENEWAL':
        await setPremium(app_user_id, true, undefined, expiration_at_ms);
        break;

      case 'CANCELLATION':
        // Subscription cancelled but still active until period end — update expiry only.
        await updateExpiry(app_user_id, expiration_at_ms);
        break;

      case 'EXPIRATION':
      case 'BILLING_ISSUE':
      case 'REFUND':
        await setPremium(app_user_id, false, undefined, undefined);
        break;

      default:
        // Unknown event type — log and acknowledge
        console.log(`RevenueCat webhook: ignoring event type=${type}`);
    }
  } catch (err) {
    console.error('RevenueCat webhook: DynamoDB update failed', err);
    return { statusCode: 500, body: 'Internal error' };
  }

  return { statusCode: 200, body: 'OK' };
};

async function setPremium(
  userId: string,
  isPremium: boolean,
  purchasedAtMs?: number,
  expirationAtMs?: number,
): Promise<void> {
  const now = new Date().toISOString();

  let updateExpr = 'SET isPremium = :premium, updatedAt = :now';
  const exprAttrValues: Record<string, unknown> = {
    ':premium': isPremium,
    ':now': now,
  };

  if (isPremium && purchasedAtMs) {
    updateExpr += ', premiumSince = if_not_exists(premiumSince, :since)';
    exprAttrValues[':since'] = new Date(purchasedAtMs).toISOString();
  }

  if (expirationAtMs) {
    updateExpr += ', premiumExpiresAt = :expires';
    exprAttrValues[':expires'] = new Date(expirationAtMs).toISOString();
  } else if (!isPremium) {
    updateExpr += ' REMOVE premiumExpiresAt';
  }

  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: updateExpr,
    ExpressionAttributeValues: exprAttrValues,
  }));
}

async function updateExpiry(userId: string, expirationAtMs?: number): Promise<void> {
  if (!expirationAtMs) return;
  await dynamo.send(new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { userId },
    UpdateExpression: 'SET premiumExpiresAt = :expires, updatedAt = :now',
    ExpressionAttributeValues: {
      ':expires': new Date(expirationAtMs).toISOString(),
      ':now': new Date().toISOString(),
    },
  }));
}
```

- [ ] **Step 2: Build backend to verify**

```bash
pnpm nx build backend-api
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/backend-api/src/handlers/webhook.handler.ts
git commit -m "feat: add RevenueCat webhook Lambda handler"
```

---

## Phase 10 — CDK Infrastructure

### Task 13: Add WebhookHandler to CDK stack

**Files:**
- Modify: `apps/infra/lib/swara-stack.ts`

- [ ] **Step 1: Add the webhook Lambda and route**

In `apps/infra/lib/swara-stack.ts`, find the section where other Lambda functions are created (look for `makeFn('UsersFn', 'users')` pattern). Add after the last Lambda definition:

```typescript
    // RevenueCat webhook handler — no JWT authorizer
    const webhookFn = makeFn('WebhookFn', 'webhook');
    webhookFn.addEnvironment('REVENUECAT_WEBHOOK_SECRET', webhookSecret.secretValue.unsafeUnwrap());
    usersTable.grantWriteData(webhookFn);
```

Find where the Secrets Manager secret should be created (before the Lambda definitions). Add:

```typescript
    // RevenueCat webhook secret — set the value manually in AWS Secrets Manager after deploy
    const webhookSecret = new secretsmanager.Secret(this, 'RevenueCatWebhookSecret', {
      secretName: `swara-${stage}-revenuecat-webhook-secret`,
      description: 'RevenueCat webhook Authorization header value',
    });
```

Add the import at the top of the file if not already present:

```typescript
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
```

Find where routes are added (look for `addRoute` calls). Add the webhook route **without** the JWT authorizer. Look for how the API is defined, there should be an `httpApi` variable. Add:

```typescript
    // Webhook route — no JWT authorizer (server-to-server from RevenueCat)
    httpApi.addRoutes({
      path: '/api/webhooks/revenuecat',
      methods: [apigwv2.HttpMethod.POST],
      integration: new HttpLambdaIntegration('WebhookIntegration', webhookFn),
    });
```

- [ ] **Step 2: Build infra to verify**

```bash
pnpm nx build infra
```

Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/infra/lib/swara-stack.ts
git commit -m "feat: add WebhookFn Lambda and /api/webhooks/revenuecat route to CDK stack"
```

---

## Phase 11 — Final Build Verification

### Task 14: Full build and smoke check

- [ ] **Step 1: Build all projects**

```bash
pnpm nx run-many -t build --all
```

Expected: all three projects (`mobile-app`, `backend-api`, `infra`) build with no errors.

- [ ] **Step 2: Lint all projects**

```bash
pnpm nx run-many -t lint --all
```

Expected: no lint errors.

- [ ] **Step 3: Serve locally and smoke test navigation**

```bash
pnpm nx serve mobile-app
```

Open `http://localhost:4200`. Verify:
- Tab bar shows: Home, Sing, Practice, Tune, Profile (5 tabs, no Tanpura tab)
- Tanpura quick action card still present on Home page
- `/tanpura` route still works when accessed directly
- Tune tab navigates to the hub showing two cards (Guitar Tuner, Violin Tuner)
- Both cards show a lock icon (premium badge) when not subscribed
- Tapping a card navigates to the tuner page and shows the paywall modal

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: final build verification — premium tuners feature complete"
```

---

## Post-Implementation Setup (Manual Steps)

These are outside code and must be done manually before the app can process real payments:

1. **App Store Connect:** Create subscription group "Swara Premium" with two products (`swara_premium_monthly` at $1.99, `swara_premium_annual` at $14.99). Set 3-day free trial on both.
2. **Google Play Console:** Create subscription with two base plans. Set 3-day free trial on both.
3. **RevenueCat Dashboard:** Create app, add both products, configure `premium` entitlement, create `default` offering with both packages.
4. **Environment keys:** Replace `appl_REPLACE_WITH_*` and `goog_REPLACE_WITH_*` in environment files with real RevenueCat API keys.
5. **AWS Secrets Manager:** After CDK deploy, set the value of `swara-{stage}-revenuecat-webhook-secret` to the Authorization header secret from the RevenueCat dashboard.
6. **RevenueCat webhook URL:** In RevenueCat dashboard, set webhook URL to `https://{your-api-gateway-url}/api/webhooks/revenuecat`.
