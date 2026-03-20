import { Component, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonRange
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { playCircle, stopCircle, musicalNote, volumeMedium, speedometer } from 'ionicons/icons';
import { TanpuraPlayerService, MusicalKey, StringConfig, TanpuraState, Instrument } from '@voice-tuner/tanpura-player';
import { AudioEngineService } from '@voice-tuner/audio-engine';
import { AnalyticsService } from '../../core/services/analytics.service';

const ALL_KEYS: MusicalKey[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const KEY_DISPLAY: Record<MusicalKey, string> = {
  'C': 'C', 'C#': 'C♯', 'D': 'D', 'D#': 'D♯', 'E': 'E',
  'F': 'F', 'F#': 'F♯', 'G': 'G', 'G#': 'G♯', 'A': 'A',
  'A#': 'A♯', 'B': 'B'
};

@Component({
  selector: 'app-tanpura',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonRange,
    AsyncPipe
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>{{ instrumentTitle((state$ | async)?.instrument ?? 'tanpura') }}</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      @if (state$ | async; as state) {
      <div class="tanpura-page">

        <!-- Hero Visual -->
        <div class="tanpura-hero" [class.is-playing]="state.isPlaying">
          <div class="resonance-rings">
            <div class="ring ring-1" [class.active]="state.isPlaying"></div>
            <div class="ring ring-2" [class.active]="state.isPlaying"></div>
            <div class="ring ring-3" [class.active]="state.isPlaying"></div>
          </div>

          <!-- Play/Stop Button -->
          <button class="play-btn" [class.is-playing]="state.isPlaying" (click)="togglePlay()">
            <span class="play-btn__icon">
              {{ state.isPlaying ? '■' : '▶' }}
            </span>
            <span class="play-btn__label">{{ state.isPlaying ? 'Stop' : 'Play' }}</span>
          </button>

          <!-- String Activity Indicators -->
          @if (state.isPlaying) {
          <div class="string-indicators">
            @for (s of stringLabels; track s; let i = $index) {
            <div
              class="string-dot"
              [class.active]="state.currentString === i"
            >{{ s }}</div>
            }
          </div>
          }

          <!-- Key Display -->
          <div class="key-badge">
            <span class="key-badge__note">{{ keyDisplay(state.key) }}</span>
            <span class="key-badge__label">Sa</span>
          </div>
        </div>

        <!-- Key Selector -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">Key</span>
            <span class="section-value">{{ keyDisplay(state.key) }}</span>
          </div>
          <div class="key-grid">
            @for (key of allKeys; track key) {
            <button
              class="key-btn"
              [class.selected]="state.key === key"
              (click)="setKey(key)"
            >
              {{ keyDisplay(key) }}
            </button>
            }
          </div>
        </div>

        <!-- Controls Grid -->
        <div class="controls-grid">

          <!-- Tempo -->
          <div class="swara-card control-card">
            <div class="control-card__header">
              <span class="control-card__label">Tempo</span>
              <span class="control-card__value">{{ state.tempo }} <small>BPM</small></span>
            </div>
            <ion-range
              [value]="state.tempo / 10"
              [min]="0"
              [max]="1"
              [step]="0.1"
              (ionChange)="setTempo($event)"
              class="swara-range"
            ></ion-range>
            <div class="range-labels">
              <span>0</span><span>Slow</span><span>Fast</span><span>10</span>
            </div>
          </div>

          <!-- Volume -->
          <div class="swara-card control-card">
            <div class="control-card__header">
              <span class="control-card__label">Volume</span>
              <span class="control-card__value">{{ (state.volume * 100) | number:'1.0-0' }}<small>%</small></span>
            </div>
            <ion-range
              [value]="state.volume"
              [min]="0"
              [max]="1"
              [step]="0.01"
              (ionChange)="setVolume($event)"
              class="swara-range"
            ></ion-range>
          </div>

          <!-- Fine Tune -->
          <div class="swara-card control-card">
            <div class="control-card__header">
              <span class="control-card__label">Fine Tune</span>
              <span class="control-card__value"
                [class.positive]="state.fineTune > 0"
                [class.negative]="state.fineTune < 0"
              >
                {{ state.fineTune > 0 ? '+' : '' }}{{ state.fineTune }}<small>¢</small>
              </span>
            </div>
            <ion-range
              [value]="state.fineTune"
              [min]="-100"
              [max]="100"
              [step]="1"
              (ionChange)="setFineTune($event)"
              class="swara-range swara-range--bipolar"
            ></ion-range>
            <div class="range-labels">
              <span>-100¢</span><span>Flat</span><span>Sharp</span><span>+100¢</span>
            </div>
          </div>

          <!-- Octave -->
          <div class="swara-card control-card">
            <div class="control-card__header">
              <span class="control-card__label">Octave</span>
              <span class="control-card__value">{{ state.octave }}</span>
            </div>
            <div class="octave-btns">
              <button class="octave-btn" [class.selected]="state.octave === 3" (click)="setOctave(3)">3</button>
              <button class="octave-btn" [class.selected]="state.octave === 4" (click)="setOctave(4)">4</button>
            </div>
          </div>

        </div>

        <!-- String Configuration -->
        <div class="section">
          <div class="section-header">
            <span class="section-title">String Tuning</span>
          </div>
          <div class="string-config-btns">
            @for (config of stringConfigs; track config) {
            <button
              class="string-config-btn"
              [class.selected]="state.stringConfig === config"
              (click)="setStringConfig(config)"
            >{{ configLabel(config) }}</button>
            }
          </div>
        </div>

      </div>
      }
    </ion-content>
  `,
  styleUrls: ['./tanpura.page.scss']
})
export class TanpuraPage implements OnDestroy {
  readonly allKeys = ALL_KEYS;
  readonly stringConfigs: StringConfig[] = ['Sa-Pa-Sa', 'Sa-Ma-Sa', 'Sa-Ma#-Sa'];
  readonly stringLabels = ['Sa', 'Pa', 'Sa'];

  private readonly configLabels: Record<StringConfig, string> = {
    'Sa-Pa-Sa': 'Sa - Pa - Sa',
    'Sa-Ma-Sa': 'Sa - Ma - Sa',
    'Sa-Ma#-Sa': 'Sa - Ma♯ - Sa',
  };

  private readonly instrumentTitles: Record<Instrument, string> = {
    tanpura: 'Tanpura',
    keyboard: 'Keyboard',
    guitar: 'Guitar',
  };

  readonly tanpura = inject(TanpuraPlayerService);
  readonly audioEngine = inject(AudioEngineService);
  readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ playCircle, stopCircle, musicalNote, volumeMedium, speedometer }))();

  state$ = this.tanpura.state$;

  private destroy$ = new Subject<void>();

  async togglePlay(): Promise<void> {
    const wasPlaying = this.tanpura.state.isPlaying;
    await this.tanpura.toggle();
    if (!wasPlaying) {
      this.analytics.logEvent('tanpura_played', { key: this.tanpura.state.key });
    }
  }

  setKey(key: MusicalKey):   void {
    this.tanpura.setKey(key);
    this.analytics.logEvent('tanpura_key_changed', { key });
  }
  setTempo(event: Event):   void {
    const v = (event as CustomEvent).detail.value;
    this.tanpura.setTempo(Math.round(v * 10));
  }
  setVolume(event: Event):  void { this.tanpura.setVolume((event as CustomEvent).detail.value); }
  setFineTune(event: Event): void { this.tanpura.setFineTune((event as CustomEvent).detail.value); }
  setOctave(o: 3 | 4):     void { this.tanpura.setOctave(o); }
  setStringConfig(c: StringConfig): void { this.tanpura.setStringConfig(c); }

  keyDisplay(key: MusicalKey): string { return KEY_DISPLAY[key]; }
  configLabel(config: StringConfig): string { return this.configLabels[config]; }
  instrumentTitle(instrument: Instrument): string { return this.instrumentTitles[instrument] ?? 'Tanpura'; }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
