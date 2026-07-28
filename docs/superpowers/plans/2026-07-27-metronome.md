# Metronome Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tanpura tab with a metronome tab that plays audio clicks at an adjustable tempo.

**Architecture:** A standalone metronome page using Web Audio API directly (no dependency on AudioEngineService or TanpuraPlayerService). The tanpura page is deleted; the tanpura-player lib is preserved (still used by sing, practice, home, settings pages).

**Tech Stack:** Angular standalone component, Ionic standalone, Web Audio API, ionicons

---

### Task 1: Create Metronome Page Component

**Files:**
- Create: `apps/mobile-app/src/app/pages/metronome/metronome.page.ts`
- Create: `apps/mobile-app/src/app/pages/metronome/metronome.page.scss`

- [ ] **Create metronome.page.ts**

```typescript
import { Component, OnDestroy, signal, ChangeDetectionStrategy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonRange, IonInput, IonIcon,
  ViewWillLeave
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { play, stop } from 'ionicons/icons';

@Component({
  selector: 'app-metronome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonRange, IonInput, IonIcon,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Metronome</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="metronome-page">

        <!-- BPM Display -->
        <div class="bpm-section">
          <input
            class="bpm-input"
            type="number"
            [value]="bpm()"
            (change)="onBpmInput($event)"
            min="20"
            max="250"
          />
          <span class="bpm-label">BPM</span>
        </div>

        <!-- Beat Indicator -->
        <div class="beat-indicator" [class.active]="isPlaying() && beatActive()">
          <div class="beat-ring"></div>
        </div>

        <!-- Tempo Slider -->
        <div class="slider-section">
          <ion-range
            [value]="bpm()"
            [min]="20"
            [max]="250"
            [step]="1"
            [pin]="true"
            (ionChange)="onBpmSlider($event)"
          ></ion-range>
          <div class="range-labels">
            <span>20</span>
            <span>250</span>
          </div>
        </div>

        <!-- Play/Stop Button -->
        <div class="controls-section">
          <ion-button
            expand="block"
            class="play-btn"
            [color]="isPlaying() ? 'danger' : 'primary'"
            (click)="togglePlay()"
          >
            <ion-icon [name]="isPlaying() ? 'stop' : 'play'" slot="start"></ion-icon>
            {{ isPlaying() ? 'Stop' : 'Start' }}
          </ion-button>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./metronome.page.scss']
})
export class MetronomePage implements OnDestroy, ViewWillLeave {
  readonly bpm = signal<number>(120);
  readonly isPlaying = signal<boolean>(false);
  readonly beatActive = signal<boolean>(false);

  private audioCtx: AudioContext | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    addIcons({ play, stop });
  }

  onBpmSlider(event: Event): void {
    const value = (event as CustomEvent).detail.value;
    this.bpm.set(value);
    this.restartIfPlaying();
  }

  onBpmInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = parseInt(input.value, 10);
    if (isNaN(value)) value = 120;
    value = Math.max(20, Math.min(250, value));
    this.bpm.set(value);
    input.value = String(value);
    this.restartIfPlaying();
  }

  togglePlay(): void {
    if (this.isPlaying()) {
      this.stop();
    } else {
      this.start();
    }
  }

  private start(): void {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    this.isPlaying.set(true);
    this.scheduleTick();
  }

  private stop(): void {
    this.isPlaying.set(false);
    this.beatActive.set(false);
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private restartIfPlaying(): void {
    if (this.isPlaying()) {
      this.stop();
      this.start();
    }
  }

  private scheduleTick(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
    }
    const intervalMs = 60000 / this.bpm();
    this.tick();
    this.timerId = setInterval(() => this.tick(), intervalMs);
  }

  private tick(): void {
    this.playClick();
    this.beatActive.set(true);
    setTimeout(() => this.beatActive.set(false), 100);
  }

  private playClick(): void {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.02);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + 0.02);
  }

  ionViewWillLeave(): void {
    this.stop();
  }

  ngOnDestroy(): void {
    this.stop();
    this.audioCtx?.close();
    this.audioCtx = null;
  }
}
```

- [ ] **Create metronome.page.scss**

```scss
.metronome-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px;
  min-height: 100%;
}

.bpm-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.bpm-input {
  font-size: 5rem;
  font-weight: 700;
  text-align: center;
  background: transparent;
  border: none;
  color: var(--ion-text-color);
  width: 200px;
  outline: none;
  -moz-appearance: textfield;
  &::-webkit-inner-spin-button,
  &::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
}

.bpm-label {
  font-size: 1rem;
  color: var(--ion-color-medium);
  text-transform: uppercase;
  letter-spacing: 2px;
}

.beat-indicator {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: var(--swara-surface);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 32px;
  transition: background 0.05s ease;
}

.beat-indicator.active {
  background: var(--swara-primary);
  box-shadow: 0 0 20px var(--swara-primary);
}

.beat-ring {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 3px solid var(--ion-color-medium);
}

.beat-indicator.active .beat-ring {
  border-color: white;
}

.slider-section {
  width: 100%;
  max-width: 320px;
  margin-bottom: 32px;
}

.range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  padding: 0 8px;
}

.controls-section {
  width: 100%;
  max-width: 240px;
}

.play-btn {
  font-size: 1.1rem;
  --border-radius: 12px;
}
```

---

### Task 2: Update Tabs Component

**Files:**
- Modify: `apps/mobile-app/src/app/tabs/tabs.component.ts`

- [ ] **Replace tanpura tab with metronome tab**

Change the icon imports and tab button:

```typescript
import {
  homeOutline, home,
  timerOutline, timer,
  micOutline, mic,
  barbellOutline, barbell,
  trendingUpOutline, trendingUp,
  settingsOutline, settings,
  personOutline, person
} from 'ionicons/icons';
```

Change the tab button in the template:

```html
<ion-tab-button tab="metronome" [routerLink]="['/metronome']">
  <ion-icon name="timer-outline"></ion-icon>
</ion-tab-button>
```

Update the icon registration:

```typescript
private readonly _icons = (() => addIcons({
  homeOutline, home,
  timerOutline, timer,
  micOutline, mic,
  barbellOutline, barbell,
  trendingUpOutline, trendingUp,
  settingsOutline, settings,
  personOutline, person
}))();
```

---

### Task 3: Update Routes

**Files:**
- Modify: `apps/mobile-app/src/app/app.routes.ts`

- [ ] **Replace tanpura route with metronome route**

```typescript
{
  path: 'metronome',
  loadComponent: () => import('./pages/metronome/metronome.page').then(m => m.MetronomePage)
},
```

Remove the tanpura route:

```typescript
// DELETE this block:
{
  path: 'tanpura',
  loadComponent: () => import('./pages/tanpura/tanpura.page').then(m => m.TanpuraPage)
},
```

---

### Task 4: Delete Tanpura Page Files

**Files:**
- Delete: `apps/mobile-app/src/app/pages/tanpura/tanpura.page.ts`
- Delete: `apps/mobile-app/src/app/pages/tanpura/tanpura.page.scss`

- [ ] **Remove tanpura page directory**

```bash
git rm -r apps/mobile-app/src/app/pages/tanpura/
```

---

### Task 5: Verify Build

- [ ] **Run type check**

```bash
npx tsc --noEmit --project apps/mobile-app/tsconfig.app.json 2>&1
```

Expected: No errors. The `TanpuraPlayerService` import in other pages (sing, practice, home, settings) is unaffected since we only deleted the tanpura page, not the library.