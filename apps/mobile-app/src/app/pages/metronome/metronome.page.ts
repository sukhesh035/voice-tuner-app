import { Component, OnDestroy, signal, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonRange,
  ViewWillLeave
} from '@ionic/angular/standalone';
import { AnalyticsService } from '../../core/services/analytics.service';

const BEAT_FLASH_MS = 100;

const BPM_LABELS: Record<string, [number, number]> = {
  'Largo':   [20, 50],
  'Adagio':  [51, 70],
  'Andante': [71, 95],
  'Moderato':[96, 120],
  'Allegro': [121, 160],
  'Vivace':  [161, 200],
  'Presto':  [201, 250],
};

function tempoLabel(bpm: number): string {
  for (const [label, [lo, hi]] of Object.entries(BPM_LABELS)) {
    if (bpm >= lo && bpm <= hi) return label;
  }
  return 'Moderato';
}

@Component({
  selector: 'app-metronome',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonRange,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Metronome</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="metronome-page">

        <!-- BPM Display Card -->
        <div class="bpm-card">
          <div class="bpm-glow" [class.active]="isPlaying()"></div>
          <input
            class="bpm-input"
            type="number"
            [value]="bpm()"
            (change)="onBpmInput($event)"
            min="20"
            max="250"
          />
          <span class="bpm-label">BPM</span>
          <span class="tempo-label">{{ tempoLabel(bpm()) }}</span>
        </div>

        <!-- Beat Rings -->
        <div class="beat-rings">
          <div class="ring ring-1" [class.active]="isPlaying() && beatActive()"></div>
          <div class="ring ring-2" [class.active]="isPlaying() && beatActive()"></div>
          <div class="ring ring-3" [class.active]="isPlaying() && beatActive()"></div>
          <div class="ring ring-4" [class.active]="isPlaying() && beatActive()"></div>
          <div class="beat-dot" [class.active]="isPlaying() && beatActive()"></div>
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
            <span>Largo</span>
            <span>Presto</span>
          </div>
        </div>

        <!-- Play Button -->
        <button
          class="play-btn"
          [class.is-playing]="isPlaying()"
          (click)="togglePlay()"
        >
          <div class="play-btn__icon">
            @if (isPlaying()) {
            <div class="stop-bars">
              <span></span><span></span>
            </div>
            } @else {
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <path d="M8 5v14l11-7z"/>
            </svg>
            }
          </div>
          <span class="play-btn__label">{{ isPlaying() ? 'Stop' : 'Start' }}</span>
        </button>

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
  private flashTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private sessionStartAt: number | null = null;
  private readonly analytics = inject(AnalyticsService);

  tempoLabel = tempoLabel;

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

  private async start(): Promise<void> {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      try {
        await this.audioCtx.resume();
      } catch {
        this.isPlaying.set(false);
        return;
      }
    }
    this.isPlaying.set(true);
    this.sessionStartAt = Date.now();
    this.analytics.logCtaTap('metronome_start', { bpm: this.bpm() });
    this.scheduleTick();
  }

  private stop(): void {
    const durationSeconds = this.sessionStartAt ? Math.round((Date.now() - this.sessionStartAt) / 1000) : 0;
    this.sessionStartAt = null;
    this.isPlaying.set(false);
    this.beatActive.set(false);
    this.analytics.logCtaTap('metronome_stop', { bpm: this.bpm(), duration_seconds: durationSeconds });
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.flashTimeoutId !== null) {
      clearTimeout(this.flashTimeoutId);
      this.flashTimeoutId = null;
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
    this.flashTimeoutId = setTimeout(() => this.beatActive.set(false), BEAT_FLASH_MS);
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