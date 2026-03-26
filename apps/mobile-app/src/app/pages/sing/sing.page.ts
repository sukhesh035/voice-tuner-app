import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, throttleTime } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonIcon, ViewWillEnter
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { DecimalPipe } from '@angular/common';
import { mic, micOff, musicalNotes, statsChart } from 'ionicons/icons';
import { PitchDetectionService, PitchResult, IndianNote } from '@voice-tuner/pitch-detection';
import { ChangeDetectorRef } from '@angular/core';
import { TanpuraPlayerService } from '@voice-tuner/tanpura-player';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '@voice-tuner/auth';
import { PermissionsService } from '../../core/services/permissions.service';

// ── Types ─────────────────────────────────────────────────
export type WesternNote = 'C' | 'C#' | 'D' | 'D#' | 'E' | 'F' | 'F#' | 'G' | 'G#' | 'A' | 'A#' | 'B';

// All 12 chromatic notes in order (index = semitone, C=0)
const WESTERN_NOTES: WesternNote[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const INDIAN_NOTES:  IndianNote[]  = ['Sa','Re♭','Re','Ga♭','Ga','Ma','Ma#','Pa','Dha♭','Dha','Ni♭','Ni'];

// ── Scale definitions ─────────────────────────────────────
export interface ScaleDefinition {
  id:        string;
  label:     string;
  intervals: number[]; // semitone offsets from root
}

export const SCALES: ScaleDefinition[] = [
  { id: 'chromatic',  label: 'Chromatic',       intervals: [0,1,2,3,4,5,6,7,8,9,10,11] },
  { id: 'major',      label: 'Major',            intervals: [0,2,4,5,7,9,11] },
  { id: 'minor',      label: 'Natural Minor',    intervals: [0,2,3,5,7,8,10] },
  { id: 'harm_min',   label: 'Harmonic Minor',   intervals: [0,2,3,5,7,8,11] },
  { id: 'mel_min',    label: 'Melodic Minor',    intervals: [0,2,3,5,7,9,11] },
  { id: 'pent_maj',   label: 'Pentatonic Major', intervals: [0,2,4,7,9] },
  { id: 'pent_min',   label: 'Pentatonic Minor', intervals: [0,3,5,7,10] },
  { id: 'blues',      label: 'Blues',            intervals: [0,3,5,6,7,10] },
  { id: 'dorian',     label: 'Dorian',           intervals: [0,2,3,5,7,9,10] },
  { id: 'phrygian',   label: 'Phrygian',         intervals: [0,1,3,5,7,8,10] },
  { id: 'lydian',     label: 'Lydian',           intervals: [0,2,4,6,7,9,11] },
  { id: 'mixolydian', label: 'Mixolydian',       intervals: [0,2,4,5,7,9,10] },
];

export const ROOT_NOTES: WesternNote[] = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Sa frequency for each key (C4 reference, equal temperament)
const SA_FREQS: Record<WesternNote, number> = {
  'C':  261.63, 'C#': 277.18, 'D':  293.66, 'D#': 311.13,
  'E':  329.63, 'F':  349.23, 'F#': 369.99, 'G':  392.00,
  'G#': 415.30, 'A':  440.00, 'A#': 466.16, 'B':  493.88,
};

/**
 * Given a scale, return the set of IndianNote names that belong to it.
 * IndianNote is always relative to Sa (index 0), so scale intervals
 * map directly onto INDIAN_NOTES indices.
 */
function buildIndianScaleSet(scale: ScaleDefinition): Set<IndianNote> {
  return new Set(scale.intervals.map(i => INDIAN_NOTES[i % 12]));
}

@Component({
  selector: 'app-sing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
    DecimalPipe
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sing</ion-title>
        <ion-button slot="end" fill="clear" [routerLink]="['/tanpura']">
          <ion-icon name="musical-notes" slot="icon-only"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content fullscreen>
      <div class="sing-page">

        <!-- Pitch Meter -->
        <div class="pitch-meter-container">
          <svg class="pitch-meter-svg" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg">
            <circle
              cx="120" cy="120" r="100"
              fill="none"
              stroke="var(--swara-border)"
              stroke-width="12"
              stroke-dasharray="565 628"
              stroke-dashoffset="-31"
              stroke-linecap="round"
            />
            <circle
              cx="120" cy="120" r="100"
              fill="none"
              [attr.stroke]="meterColor"
              stroke-width="12"
              stroke-linecap="round"
              [style.stroke-dasharray]="meterDash"
              [style.stroke-dashoffset]="meterOffset"
              [style.filter]="isInTune ? 'drop-shadow(0 0 8px ' + meterColor + ')' : 'none'"
              [style.transition]="'stroke-dashoffset 0.1s linear, stroke 0.15s ease'"
              transform="rotate(-225 120 120)"
            />
            @for (angle of noteAngles; track angle) {
            <g>
              <line
                [attr.x1]="120 + 84 * cos(angle)"
                [attr.y1]="120 + 84 * sin(angle)"
                [attr.x2]="120 + 92 * cos(angle)"
                [attr.y2]="120 + 92 * sin(angle)"
                stroke="var(--swara-border)"
                stroke-width="2"
                stroke-linecap="round"
              />
            </g>
            }
          </svg>

          <div class="pitch-center">
            <div class="note-name" [style.color]="meterColor">
              {{ currentPitch?.indianNote ?? '–' }}
            </div>
            <div class="hz-value" [class.hidden]="!currentPitch">
              {{ (currentPitch?.frequency ?? 0) | number:'1.1-1' }} Hz
            </div>
            <div class="cents-badge"
              [class.hidden]="!currentPitch"
              [class.sharp]="(currentPitch?.centsOff ?? 0) > 10"
              [class.flat]="(currentPitch?.centsOff ?? 0) < -10"
              [class.in-tune]="isInTune"
            >
              {{ (currentPitch?.centsOff ?? 0) > 0 ? '+' : '' }}{{ (currentPitch?.centsOff ?? 0) | number:'1.0-0' }}¢
            </div>
            @if (!currentPitch && isActive) {
            <div class="no-pitch">Sing...</div>
            }
          </div>
        </div>

        <!-- Tuner Needle -->
        <div class="tuner-section">
          <div class="tuner-labels">
            <span>-50¢</span><span>-25¢</span><span>In Tune</span><span>+25¢</span><span>+50¢</span>
          </div>
          <div class="tuner-gauge">
            <div class="tuner-center-mark"></div>
            <div
              class="tuner-needle"
              [class.in-tune]="isInTune"
              [class.idle]="!currentPitch"
              [style.transform]="'translateX(-50%) rotate(' + needleAngle + 'deg)'"
            ></div>
          </div>
        </div>

        <!-- Accuracy Bar -->
        <div class="accuracy-section">
          <div class="accuracy-label">
            <span>Accuracy</span>
            <span class="accuracy-value" [style.color]="meterColor">
              {{ currentPitch ? ((currentPitch.accuracy | number:'1.0-0') + '%') : '–%' }}
            </span>
          </div>
          <div class="swara-progress-bar">
            <div
              class="progress-fill"
              [style.width]="(currentPitch?.accuracy ?? 0) + '%'"
              [style.background]="meterGradient"
            ></div>
          </div>
        </div>

        <!-- Key + Scale Dropdowns -->
        <div class="selectors-row">
          <div class="selector-group">
            <label class="selector-label" for="key-select">Key</label>
            <div class="select-wrapper">
              <select
                id="key-select"
                class="selector-select"
                [value]="selectedRoot"
                (change)="onRootChange($event)"
              >
                @for (root of rootNotes; track root) {
                <option [value]="root">{{ root }}</option>
                }
              </select>
            </div>
          </div>

          <div class="selector-group">
            <label class="selector-label" for="scale-select">Scale</label>
            <div class="select-wrapper">
              <select
                id="scale-select"
                class="selector-select"
                [value]="selectedScale.id"
                (change)="onScaleChange($event)"
              >
                @for (scale of scales; track scale.id) {
                <option [value]="scale.id">{{ scale.label }}</option>
                }
              </select>
            </div>
          </div>
        </div>

        <!-- Note Grid (Carnatic / Sargam) -->
        <div class="note-grid-section">
          <div class="section-title">
            Notes Detected
            <span class="scale-badge">{{ selectedRoot }} {{ selectedScale.label }}</span>
          </div>
          <div class="swara-note-grid">
            @for (note of allNotes; track note; let i = $index) {
            <div
              class="note-chip"
              [class.active]="detectedNotes.has(note)"
              [class.current]="currentPitch?.indianNote === note"
              [class.out-of-scale]="!scaleNoteSet.has(note)"
              [style.--note-color]="noteColors[i]"
            >
              <span class="note-name">{{ note }}</span>
            </div>
            }
          </div>
        </div>

        <!-- Start / Stop Button -->
        <div class="mic-section">
          <button
            class="sing-btn"
            [class.is-active]="isActive"
            (click)="toggleMic()"
          >
            {{ isActive ? 'Stop Singing' : 'Start Singing' }}
          </button>

          @if (micError) {
          <div class="mic-error">{{ micError }}</div>
          @if (micPermDenied) {
          <button class="open-settings-btn" (click)="openSettings()">Open Settings</button>
          }
          }

          <div class="waveform-bars" [class.silent]="!currentPitch">
            @for (_ of [1,2,3,4,5,6,7,8]; track $index) {
            <div class="bar"></div>
            }
          </div>
        </div>

        <!-- Stats Row -->
        <div class="stats-row" [class.stats-hidden]="sessionStats.sampleCount === 0">
          <div class="swara-stat-card">
            <div class="stat-value">{{ sessionStats.stabilityScore | number:'1.0-0' }}</div>
            <div class="stat-label">Stability</div>
          </div>
          <div class="swara-stat-card">
            <div class="stat-value">{{ sessionStats.averageCentsOff | number:'1.0-0' }}¢</div>
            <div class="stat-label">Avg Deviation</div>
          </div>
          <div class="swara-stat-card">
            <div class="stat-value">{{ sessionStats.sampleCount }}</div>
            <div class="stat-label">Notes</div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./sing.page.scss']
})
export class SingPage implements OnInit, OnDestroy, ViewWillEnter {
  readonly allNotes:  IndianNote[]       = INDIAN_NOTES;
  readonly scales:    ScaleDefinition[]  = SCALES;
  readonly rootNotes: WesternNote[]      = ROOT_NOTES;

  readonly noteColors = [
    '#FF6B6B','#FF8E53','#FFC300','#A8FF78','#4CAF50',
    '#26C6DA','#7C4DFF','#2196F3','#9C27B0','#CE93D8','#E91E63','#FF80AB'
  ];
  readonly noteAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2 - Math.PI / 2);

  currentPitch:  PitchResult | null = null;
  isActive       = false;
  detectedNotes  = new Set<IndianNote>();
  sessionStats   = { sampleCount: 0, stabilityScore: 0, averageCentsOff: 0 };
  micError:      string | null = null;
  micPermDenied  = false;

  selectedRoot:  WesternNote     = 'C';
  selectedScale: ScaleDefinition = SCALES[1]; // Major by default
  scaleNoteSet:  Set<IndianNote> = buildIndianScaleSet(SCALES[1]);

  private destroy$ = new Subject<void>();

  // ── Getters ──────────────────────────────────────────────
  get isInTune(): boolean { return this.currentPitch?.isInTune ?? false; }
  get meterColor(): string {
    if (!this.currentPitch) return 'var(--swara-border)';
    if (this.isInTune) return 'var(--swara-pitch-perfect)';
    if (Math.abs(this.currentPitch.centsOff) < 30) return 'var(--swara-pitch-close)';
    return 'var(--swara-pitch-off)';
  }
  get meterGradient(): string {
    return `linear-gradient(90deg, ${this.meterColor} 0%, ${this.meterColor} 100%)`;
  }
  get meterDash(): string {
    const pct = Math.min(1, (this.currentPitch?.accuracy ?? 0) / 100);
    return `${pct * 565} 628`;
  }
  get meterOffset(): string { return '-31'; }
  get needleAngle(): number {
    if (!this.currentPitch) return 0;
    return Math.max(-45, Math.min(45, this.currentPitch.centsOff * 0.9));
  }

  // ── Injections ───────────────────────────────────────────
  readonly pitchDetection = inject(PitchDetectionService);
  readonly tanpura        = inject(TanpuraPlayerService);
  readonly api            = inject(ApiService);
  readonly analytics      = inject(AnalyticsService);
  readonly authService    = inject(AuthService);
  readonly permissions    = inject(PermissionsService);
  private readonly cdr: ChangeDetectorRef = inject(ChangeDetectorRef);
  private readonly _icons = (() => addIcons({ mic, micOff, musicalNotes, statsChart }))();

  ngOnInit(): void {
    this.pitchDetection.pitch$
      .pipe(takeUntil(this.destroy$), throttleTime(50))
      .subscribe(pitch => {
        this.currentPitch = pitch;
        if (pitch) this.detectedNotes.add(pitch.indianNote);
        try { this.cdr.markForCheck(); } catch {}
      });
  }

  // Re-check mic permission when user returns from OS settings
  async ionViewWillEnter(): Promise<void> {
    await this.permissions.checkPermissions();
    // If permission was just granted, clear any previous error
    if (this.permissions.micPermission === 'granted' && this.micPermDenied) {
      this.micError = null;
      this.micPermDenied = false;
      this.cdr.markForCheck();
    }
  }

  // ── Dropdown handlers ────────────────────────────────────
  onRootChange(event: Event): void {
    this.selectedRoot = (event.target as HTMLSelectElement).value as WesternNote;
    this.pitchDetection.setSa(SA_FREQS[this.selectedRoot]);
    this.updateScaleNoteSet();
    this.detectedNotes.clear();
    this.cdr.markForCheck();
  }

  onScaleChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.selectedScale = SCALES.find(s => s.id === id) ?? SCALES[1];
    this.updateScaleNoteSet();
    this.detectedNotes.clear();
    this.analytics.logEvent('scale_selected', { scale_id: this.selectedScale.id, root: this.selectedRoot });
    this.cdr.markForCheck();
  }

  private updateScaleNoteSet(): void {
    this.scaleNoteSet = buildIndianScaleSet(this.selectedScale);
  }

  // ── Mic toggle ───────────────────────────────────────────
  async toggleMic(): Promise<void> {
    if (this.isActive) {
      this.pitchDetection.stop();
      const stats = this.pitchDetection.getSessionStats();
      this.sessionStats = stats as any;
      this.isActive = false;
      this.micError = null;
      this.micPermDenied = false;
      this.analytics.logEvent('mic_stopped', {
        duration_seconds: Math.round(stats.sessionDuration),
        stability_score:  Math.round(stats.stabilityScore),
      });

      const tanpuraState    = this.tanpura.state;
      const durationSeconds = Math.round(stats.sessionDuration);
      if (durationSeconds > 0 && this.authService.currentUser?.emailVerified) {
        const noteAccuracies: Record<string, number> = {};
        for (const [note, acc] of Object.entries(stats.noteAccuracies)) {
          noteAccuracies[note] = acc as number;
        }
        this.api.createSession({
          duration:       durationSeconds,
          mode:           'free',
          key:            tanpuraState.key,
          score:          Math.round(stats.stabilityScore),
          avgAccuracy:    Math.round(100 - Math.abs(stats.averageCentsOff) * 2),
          stabilityScore: Math.round(stats.stabilityScore),
          noteAccuracies,
        }).then(() => {
          this.analytics.logEvent('sing_session_saved', { duration_seconds: durationSeconds });
          this.api.checkin(Math.ceil(durationSeconds / 60), Math.round(stats.stabilityScore)).catch(() => {});
        }).catch((err: any) => console.warn('[SingPage] Failed to save session:', err));
      }
    } else {
      try {
        // On Android, proactively request mic permission so the native
        // RECORD_AUDIO dialog appears before getUserMedia is called.
        // This is a no-op if permission is already granted.
        if (this.permissions.micPermission !== 'granted') {
          const state = await this.permissions.requestMicPermission();
          if (state !== 'granted') {
            this.micError = 'Microphone permission denied. Please allow access and try again.';
            this.micPermDenied = true;
            this.analytics.logEvent('mic_permission_denied');
            this.cdr.markForCheck();
            return;
          }
        }

        await this.pitchDetection.start();
        this.detectedNotes.clear();
        this.isActive = true;
        this.micError = null;
        this.micPermDenied = false;
        this.analytics.logEvent('mic_started');
      } catch (err: any) {
        const isDenied = (err as { name?: string })?.name === 'NotAllowedError';
        this.micError = isDenied
          ? 'Microphone permission denied. Please allow access and try again.'
          : 'Could not start microphone. Please try again.';
        this.micPermDenied = isDenied;
        if (isDenied) this.analytics.logEvent('mic_permission_denied');
      }
    }
    this.cdr.markForCheck();
  }

  cos(angle: number): number { return Math.cos(angle); }
  sin(angle: number): number { return Math.sin(angle); }

  async openSettings(): Promise<void> {
    await this.permissions.openAppSettings();
  }

  ngOnDestroy(): void {
    this.pitchDetection.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
