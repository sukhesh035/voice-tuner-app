# "What's New" Per-Release Feature Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a one-time-per-release slideshow tour highlighting new features, triggered automatically on app boot and tracked in analytics.

**Architecture:** A `FeatureTourService` resolves the current OTA update version as the "release key" and decides whether to show. A standalone `FeatureTourComponent` renders the slideshow as an Ionic modal. `AppComponent` triggers it after auth init. Each interaction logs analytics events.

**Tech Stack:** Angular standalone, Ionic ModalController, @capgo/capacitor-updater, Capacitor App, Firebase Analytics

---

### Task 1: Create FeatureTourService

**Files:**
- Create: `apps/mobile-app/src/app/core/services/feature-tour.service.ts`

- [ ] **Step 1: Create the service**

```typescript
import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { ModalController } from '@ionic/angular/standalone';
import { FeatureTourComponent } from '../../shared/components/feature-tour/feature-tour.component';
import { AnalyticsService } from './analytics.service';

export interface FeatureSlide {
  icon: string;        // ionicons name, e.g. 'musical-notes-outline'
  title: string;
  description: string;
  target?: string;     // optional route to deep-link to
}

// Compile-time key used on web/dev where OTA is not available.
const DEV_TOUR_KEY = 'dev-tour-1';

/** Curated slides keyed by release key (OTA version string). */
const TOUR_CONTENT: Record<string, FeatureSlide[]> = {
  // Key matches the OTA bundle version at the time this ships.
  '1.1.0': [
    {
      icon: 'speedometer-outline',
      title: 'Metronome & Tanpura',
      description: 'Two tabs in one screen — keep time with the metronome while a tanpura drone plays underneath.',
      target: '/metronome',
    },
    {
      icon: 'trending-up-outline',
      title: 'Ear Training Levels',
      description: 'Choose your difficulty — from a simple Sa–Re–Ga up to the full 12-note octave.',
      target: '/practice',
    },
    {
      icon: 'library-outline',
      title: 'Janya Ragas',
      description: 'Browse Melakarta parent ragas and the janya ragas derived from them.',
      target: '/practice',
    },
  ],
};

@Injectable({ providedIn: 'root' })
export class FeatureTourService {
  private readonly analytics = inject(AnalyticsService);

  private lastSeenKey: string | null = null;

  constructor() {
    try {
      this.lastSeenKey = localStorage.getItem('swara-last-tour-key');
    } catch {
      this.lastSeenKey = null;
    }
  }

  /** Resolve the current release (OTA bundle version, native version, or dev key). */
  async resolveCurrentKey(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        const cap = CapacitorUpdater;
        if (cap) {
          const current = await cap.current();
          return current?.bundle?.version ?? String(current?.bundle?.version ?? '');
        }
      }
    } catch {
      // fall through to below
    }
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await App.getInfo();
        if (info?.version) return info.version;
      }
    } catch {
      // fall through
    }
    return DEV_TOUR_KEY;
  }

  /** Slides for the current release key (empty if none defined). */
  getSlides(key: string): FeatureSlide[] {
    return TOUR_CONTENT[key] ?? [];
  }

  /** Whether the tour should show for this release key. */
  shouldShow(key: string): boolean {
    return key !== this.lastSeenKey && (TOUR_CONTENT[key]?.length ?? 0) > 0;
  }

  /** Persist that the tour was shown for this key. */
  markShown(key: string): void {
    this.lastSeenKey = key;
    try {
      localStorage.setItem('swara-last-tour-key', key);
    } catch {
      // non-fatal
    }
  }

  /** Present the tour if a new release is detected. */
  async maybeShowTour(modalCtrl: ModalController): Promise<void> {
    const key = await this.resolveCurrentKey();
    const slides = this.getSlides(key);
    if (!this.shouldShow(key) || slides.length === 0) return;

    this.analytics.logEvent('feature_tour_started', { release_key: key, total_steps: slides.length });
    const modal = await modalCtrl.create({
      component: FeatureTourComponent,
      cssClass: 'feature-tour-modal',
      componentProps: { slides, releaseKey: key },
    });
    await modal.present();
    await modal.onWillDismiss();
    // Mark shown regardless of how it was dismissed (completed/skip/link-out).
    this.markShown(key);
  }
}
```

- [ ] **Step 2: Verify CapacitorUpdater.current() return shape**

Check `node_modules/@capgo/capacitor-updater` typings. The `current()` returns a `BundleInfo` with a `bundle` property that has `version`. If the actual shape differs, adjust `resolveCurrentKey` accordingly (e.g. `current.bundle.version`). Run:

```bash
grep -rn "current(" node_modules/@capgo/capacitor-updater/dist/*.d.ts | head
```

---

### Task 2: Create FeatureTourComponent

**Files:**
- Create: `apps/mobile-app/src/app/shared/components/feature-tour/feature-tour.component.ts`
- Create: `apps/mobile-app/src/app/shared/components/feature-tour/feature-tour.component.scss`

- [ ] **Step 1: Create the component**

```typescript
import { Component, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, arrowForwardOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { FeatureSlide } from '../../../core/services/feature-tour.service';

@Component({
  selector: 'app-feature-tour',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>What's New</ion-title>
        <ion-button slot="end" fill="clear" (click)="skip()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="tour-page">
        @if (slides.length > 0) {
        <div class="tour-slide" [@?]>
          <div class="tour-icon">
            <ion-icon [name]="currentSlide().icon"></ion-icon>
          </div>
          <h2 class="tour-title">{{ currentSlide().title }}</h2>
          <p class="tour-desc">{{ currentSlide().description }}</p>
        </div>
        }

        <div class="tour-progress">
          <div class="progress-dots">
            @for (s of slides; track $index) {
            <span
              class="progress-dot"
              [class.active]="$index === step()"
            ></span>
            }
          </div>
        </div>

        <div class="tour-controls">
          @if (currentSlide().target) {
          <ion-button fill="outline" (click)="openTarget()">Try it</ion-button>
          }
          @if (step() < slides.length - 1) {
          <ion-button class="primary" (click)="next()">
            Next
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
          </ion-button>
          } @else {
          <ion-button class="primary" (click)="done()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            Done
          </ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styleUrls: ['./feature-tour.component.scss']
})
export class FeatureTourComponent {
  slides!: FeatureSlide[];
  releaseKey = '';

  readonly step = signal<number>(0);
  readonly currentSlide = signal<FeatureSlide | null>(null);

  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ closeOutline, arrowForwardOutline, checkmarkCircleOutline }))();

  constructor() {
    // componentProps are set before construction via the modal, but Ionic
    // injects them as instance props; read in ngAfterContentInit-safe way.
  }

  private _inited = false;
  ngOnInit(): void {
    if (this._inited) return;
    this._inited = true;
    this.currentSlide.set(this.slides[0] ?? null);
  }

  next(): void {
    const nextStep = this.step() + 1;
    this.step.set(nextStep);
    this.currentSlide.set(this.slides[nextStep] ?? null);
    this.analytics.logEvent('feature_tour_step', {
      release_key: this.releaseKey,
      step: nextStep,
      total_steps: this.slides.length,
    });
  }

  skip(): void {
    this.analytics.logEvent('feature_tour_skipped', { release_key: this.releaseKey });
    this.modalCtrl.dismiss(null, 'skipped');
  }

  done(): void {
    this.analytics.logEvent('feature_tour_completed', {
      release_key: this.releaseKey,
      total_steps: this.slides.length,
    });
    this.modalCtrl.dismiss(null, 'completed');
  }

  openTarget(): void {
    this.analytics.logEvent('feature_tour_open_target', {
      release_key: this.releaseKey,
      target: this.currentSlide()?.target,
    });
    const target = this.currentSlide()?.target;
    this.modalCtrl.dismiss(null, 'target');
    if (target) {
      this.router.navigate([target]);
    }
  }
}
```

- [ ] **Step 2: Create the SCSS**

```scss
.tour-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 32px 24px;
  text-align: center;
  gap: 24px;
}

.tour-icon {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  background: var(--swara-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 32px rgba(var(--swara-primary-rgb), 0.4);

  ion-icon {
    font-size: 44px;
    color: #FFFFFF;
  }
}

.tour-title {
  font-size: 24px;
  font-weight: 800;
  color: var(--swara-text-primary);
  margin: 0;
}

.tour-desc {
  font-size: 15px;
  line-height: 1.5;
  color: var(--swara-text-secondary);
  max-width: 300px;
  margin: 0;
}

.tour-progress {
  display: flex;
  justify-content: center;
}

.progress-dots {
  display: flex;
  gap: 8px;
}

.progress-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--swara-border);
  transition: all 0.2s ease;

  &.active {
    width: 20px;
    border-radius: 4px;
    background: var(--swara-primary);
  }
}

.tour-controls {
  display: flex;
  gap: 12px;
  align-items: center;

  .primary {
    --background: var(--swara-gradient-primary);
    --background-hover: var(--swara-primary);
    min-width: 140px;
  }
}
```

- [ ] **Step 3: Note — `@?` is not valid syntax**

The `[@?]` in the template was a placeholder symbol; remove it. The slide div should have no animation binding (keep it simple). Verify the final template has `class="tour-slide"` with no `[@?]` attribute.

---

### Task 3: Wire into AppComponent

**Files:**
- Modify: `apps/mobile-app/src/app/app.component.ts`

- [ ] **Step 1: Add imports**

```typescript
import { ModalController } from '@ionic/angular/standalone';
import { FeatureTourService } from './core/services/feature-tour.service';
```

- [ ] **Step 2: Inject services**

In the class, add to the existing injects:

```typescript
  private readonly featureTour = inject(FeatureTourService);
  private readonly modalCtrl = inject(ModalController);
```

- [ ] **Step 3: Trigger the tour after auth init**

In `ngOnInit`, inside the `.then()` after the auth race resolves, add at the end (after the `if (this.authService.currentUser)` block but still within the then):

```typescript
      // Show the per-release "What's New" tour (once per OTA version).
      this.featureTour.maybeShowTour(this.modalCtrl).catch(() => {});
```

The resulting structure should be:

```typescript
    Promise.race([this.authService.initialize(), timeout]).then(async () => {
      if (this.authService.currentUser) {
        try {
          ...
        } catch (err) {
          console.error('[App] Profile/permissions init failed', err);
        }
      }
      // Show the per-release "What's New" tour (once per OTA version).
      this.featureTour.maybeShowTour(this.modalCtrl).catch(() => {});
    });
```

---

### Task 4: Verify Build

- [ ] **Step 1: Production build**

```bash
pnpm nx build mobile-app --configuration=production 2>&1 | grep -iE 'error' | grep -v 'npm warn'
```

Expected: no errors. Fix any that appear (e.g. CapacitorUpdater shape, unused imports).

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: add per-release What's New feature tour with analytics"
```