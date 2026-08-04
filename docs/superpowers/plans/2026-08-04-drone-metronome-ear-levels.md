# Drone + Metronome, Practice Drone, and Ear Training Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tanpura drone to the Metronome tab and Sing page, add ear training difficulty levels, and log analytics for all of it.

**Architecture:** Reuses the existing `TanpuraPlayerService` (independent AudioContext) in the Metronome and Sing pages. Ear training level selector filters the note pool. All new interactions log analytics events.

**Tech Stack:** Angular standalone, Ionic standalone, TanpuraPlayerService, AnalyticsService

---

### Task 1: Add Drone Card to Metronome Page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/metronome/metronome.page.ts`
- Modify: `apps/mobile-app/src/app/pages/metronome/metronome.page.scss`

- [ ] **Step 1: Add imports for TanpuraPlayerService and new Ionic components**

In the imports section (top of file), change:

```typescript
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonRange,
  ViewWillLeave
} from '@ionic/angular/standalone';
import { AnalyticsService } from '../../core/services/analytics.service';
```

to:

```typescript
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonRange, IonToggle, IonSelect, IonSelectOption,
  ViewWillLeave
} from '@ionic/angular/standalone';
import { AnalyticsService } from '../../core/services/analytics.service';
import { TanpuraPlayerService, MusicalKey } from '@voice-tuner/tanpura-player';
```

- [ ] **Step 2: Add keys constant after `tempoLabel` function**

```typescript
const DRONE_KEYS: MusicalKey[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
```

- [ ] **Step 3: Update the imports array in the @Component decorator**

Change:

```typescript
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonRange,
  ],
```

to:

```typescript
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonRange, IonToggle, IonSelect, IonSelectOption,
  ],
```

- [ ] **Step 4: Add the Drone card to the template** — insert before the closing `</div>` of `.metronome-page` (after the Play Button block):

```html
        <!-- Drone Card -->
        <div class="drone-card">
          <div class="drone-header">
            <span class="drone-title">Tanpura Drone</span>
            <ion-toggle
              [checked]="droneOn()"
              (ionChange)="toggleDrone($event)"
            ></ion-toggle>
          </div>

          <div class="drone-controls">
            <div class="drone-control">
              <label class="drone-control__label">Key</label>
              <ion-select
                [value]="droneKey()"
                (ionChange)="onDroneKey($event)"
                class="drone-select"
              >
                @for (key of droneKeys; track key) {
                <ion-select-option [value]="key">{{ key }}</ion-select-option>
                }
              </ion-select>
            </div>
            <div class="drone-control">
              <label class="drone-control__label">Volume</label>
              <ion-range
                [value]="droneVolume()"
                [min]="0"
                [max]="1"
                [step]="0.01"
                (ionChange)="onDroneVolume($event)"
                class="drone-volume"
              ></ion-range>
            </div>
          </div>
        </div>
```

- [ ] **Step 5: Add drone state signals and logic to the class**

After the existing signal declarations (`beatActive`), add:

```typescript
  readonly droneOn = signal<boolean>(false);
  readonly droneKey = signal<MusicalKey>('C');
  readonly droneVolume = signal<number>(0.7);
  readonly droneKeys = DRONE_KEYS;
```

Add a TanpuraPlayerService injection:

```typescript
  private readonly tanpura = inject(TanpuraPlayerService);
```

Add the drone methods after `togglePlay()`:

```typescript
  toggleDrone(event: Event): void {
    const on = (event as CustomEvent).detail.checked as boolean;
    this.droneOn.set(on);
    this.analytics.logEvent('drone_toggled', { on, source: 'metronome' });
    if (on) {
      this.tanpura.setKey(this.droneKey());
      this.tanpura.setVolume(this.droneVolume());
      this.tanpura.play();
    } else {
      this.tanpura.stop();
    }
  }

  onDroneKey(event: Event): void {
    const key = (event as CustomEvent).detail.value as MusicalKey;
    this.droneKey.set(key);
    this.analytics.logEvent('drone_key_changed', { key, source: 'metronome' });
    if (this.droneOn()) {
      this.tanpura.setKey(key);
    }
  }

  onDroneVolume(event: Event): void {
    const vol = (event as CustomEvent).detail.value as number;
    this.droneVolume.set(vol);
    this.analytics.logEvent('drone_volume_changed', { volume: vol });
    this.tanpura.setVolume(vol);
  }
```

- [ ] **Step 6: Stop the drone on tab leave and destroy**

Update `ionViewWillLeave()`:

```typescript
  ionViewWillLeave(): void {
    this.stop();
    this.tanpura.stop();
    this.droneOn.set(false);
  }
```

Update `ngOnDestroy()`:

```typescript
  ngOnDestroy(): void {
    this.stop();
    this.tanpura.stop();
    this.audioCtx?.close();
    this.audioCtx = null;
  }
```

- [ ] **Step 7: Add Drone card styles to `metronome.page.scss`**

Append:

```scss
// ── Drone Card ────────────────────────────────────────────
.drone-card {
  width: 100%;
  max-width: 320px;
  background: var(--swara-bg-card);
  border: 1px solid var(--swara-border);
  border-radius: 20px;
  padding: 16px;
  margin-top: 8px;
}

.drone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.drone-title {
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--ion-text-color);
}

.drone-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}

.drone-control {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.drone-control__label {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 1px;
  min-width: 44px;
}

.drone-select {
  flex: 1;
  --padding-start: 8px;
}

.drone-volume {
  flex: 1;
}
```

- [ ] **Step 8: Verify build**

```bash
pnpm nx build mobile-app --configuration=development 2>&1 | grep -iE 'error|warning' | grep -v 'npm warn'
```

Expected: no output.

---

### Task 2: Add Drone Toggle to Sing Page

**Files:**
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.ts`
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.scss`

- [ ] **Step 1: Add IonToggle to imports**

Change the Ionic imports:

```typescript
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  ViewWillEnter, ViewWillLeave
} from '@ionic/angular/standalone';
```

to:

```typescript
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonToggle,
  ViewWillEnter, ViewWillLeave
} from '@ionic/angular/standalone';
```

- [ ] **Step 2: Add IonToggle to the @Component imports array**

Change:

```typescript
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    DecimalPipe
  ],
```

to:

```typescript
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent, IonToggle,
    DecimalPipe
  ],
```

- [ ] **Step 3: Add drone toggle to the template** — inside `.mic-section`, before the Start/Stop button:

```html
        <!-- Drone Toggle -->
        <div class="drone-toggle-row">
          <span class="drone-toggle-label">Tanpura Drone</span>
          <ion-toggle
            [checked]="droneOn"
            (ionChange)="toggleDrone($event)"
          ></ion-toggle>
        </div>
```

- [ ] **Step 4: Add drone state and logic to the class**

Add a field near `isActive`:

```typescript
  droneOn = false;
```

Add a method after `toggleMic()` (before `cos()`):

```typescript
  toggleDrone(event: Event): void {
    const on = (event as CustomEvent).detail.checked as boolean;
    this.droneOn = on;
    this.analytics.logEvent('drone_toggled', { on, source: 'sing' });
    if (on) {
      this.tanpura.setVolume(0.7);
      this.tanpura.play();
    } else {
      this.tanpura.stop();
    }
    this.cdr.markForCheck();
  }
```

- [ ] **Step 5: Stop the drone on tab leave**

In `ionViewWillLeave()`, add `this.tanpura.stop();` right after `this.pitchDetection.stop();`:

```typescript
  ionViewWillLeave(): void {
    if (this.isActive) {
      this.pitchDetection.stop();
      this.tanpura.stop();
      this.droneOn = false;
      ...
```

- [ ] **Step 6: Add drone toggle styles to `sing.page.scss`**

Append:

```scss
// ── Drone Toggle ──────────────────────────────────────────
.drone-toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 280px;
  padding: 4px 8px;
}

.drone-toggle-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--swara-text-secondary);
}
```

- [ ] **Step 7: Verify build**

```bash
pnpm nx build mobile-app --configuration=development 2>&1 | grep -iE 'error|warning' | grep -v 'npm warn'
```

Expected: no output.

---

### Task 3: Add Ear Training Difficulty Levels

**Files:**
- Modify: `apps/mobile-app/src/app/pages/practice/practice.page.ts`
- Modify: `apps/mobile-app/src/app/pages/practice/practice.page.scss`

- [ ] **Step 1: Add level constants near `ALL_SHRUTI_NOTES`**

After the `ALL_SHRUTI_NOTES` const (around line 73), add:

```typescript
// Ear Training difficulty levels — each restricts the note pool
export type EarLevel = 1 | 2 | 3;
const EAR_LEVEL_NOTES: Record<EarLevel, IndianNote[]> = {
  1: ['Sa','Re','Ga'],
  2: ['Sa','Re','Ga','Ma','Pa'],
  3: ALL_SHRUTI_NOTES,
};
const EAR_LEVEL_LABELS: Record<EarLevel, string> = {
  1: 'Beginner — Sa, Re, Ga',
  2: 'Intermediate — Sa to Pa',
  3: 'Advanced — All 12 notes',
};
```

- [ ] **Step 2: Add `earLevel` state**

In the Ear Training state section, add:

```typescript
  earLevel: EarLevel = 1;
```

- [ ] **Step 3: Update `drawEarNote()`**

Change:

```typescript
  private drawEarNote(): IndianNote {
    if (this.earNotePool.length === 0) {
      this.earNotePool = this.shuffle(ALL_SHRUTI_NOTES);
    }
    return this.earNotePool.pop()!;
  }
```

to:

```typescript
  private drawEarNote(): IndianNote {
    if (this.earNotePool.length === 0) {
      this.earNotePool = this.shuffle(EAR_LEVEL_NOTES[this.earLevel]);
    }
    return this.earNotePool.pop()!;
  }
```

- [ ] **Step 4: Add level selector to the Ear Training intro template**

In the intro card (`@if (!sessionActive)` block), after the `.ear-intro__desc` and before `.ear-intro__steps`, add:

```html
            <div class="ear-level-selector">
              <div class="ear-level-title">Difficulty</div>
              <div class="ear-level-options">
                @for (lvl of [1,2,3] as EarLevel[]; track lvl) {
                <button
                  class="ear-level-btn"
                  [class.selected]="earLevel === lvl"
                  (click)="setEarLevel(lvl)"
                >
                  {{ EAR_LEVEL_LABELS[lvl] }}
                </button>
                }
              </div>
            </div>
```

- [ ] **Step 5: Add `setEarLevel` method**

Add near the ear training methods:

```typescript
  setEarLevel(level: EarLevel): void {
    this.earLevel = level;
    this.earNotePool = [];
    this.analytics.logEvent('ear_level_selected', { level });
    this.cdr.markForCheck();
  }
```

- [ ] **Step 6: Add analytics to ear training start**

In `startSession()` free-mode branch (after `this.earNotePool = [];`), add:

```typescript
      this.analytics.logEvent('ear_training_started', { level: this.earLevel });
```

- [ ] **Step 7: Expose labels in the class**

Add class fields:

```typescript
  readonly EAR_LEVEL_LABELS = EAR_LEVEL_LABELS;
```

- [ ] **Step 8: Add level selector styles to `practice.page.scss`**

Append:

```scss
// ── Ear Level Selector ────────────────────────────────────
.ear-level-selector {
  margin-top: $spacing-3;
}

.ear-level-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--swara-text-secondary);
  margin-bottom: $spacing-2;
}

.ear-level-options {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.ear-level-btn {
  width: 100%;
  padding: $spacing-3;
  border-radius: $radius-md;
  border: 1.5px solid var(--swara-border);
  background: var(--swara-bg-card);
  color: var(--swara-text-primary);
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;

  &.selected {
    border-color: var(--swara-primary);
    background: rgba(var(--swara-primary-rgb), 0.1);
    color: var(--swara-primary);
  }
}
```

- [ ] **Step 9: Verify build**

```bash
pnpm nx build mobile-app --configuration=development 2>&1 | grep -iE 'error|warning' | grep -v 'npm warn'
```

Expected: no output.

---

### Task 4: Final Verification

- [ ] **Step 1: Full production build**

```bash
pnpm nx build mobile-app --configuration=production 2>&1 | grep -iE 'error' | grep -v 'npm warn'
```

Expected: no output.

- [ ] **Step 2: Commit**

```bash
git add apps/mobile-app/src/app/pages/metronome/ apps/mobile-app/src/app/pages/sing/ apps/mobile-app/src/app/pages/practice/
git commit -m "feat: add tanpura drone to metronome and sing, ear training levels, analytics"
```
