import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil, filter, throttleTime } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { mic, micOff, musicalNotes, statsChart } from 'ionicons/icons';
import { PitchDetectionService, PitchResult, IndianNote } from '@voice-tuner/pitch-detection';
import { TanpuraPlayerService } from '@voice-tuner/tanpura-player';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-sing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon
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
            <!-- Background track -->
            <circle
              cx="120" cy="120" r="100"
              fill="none"
              stroke="var(--sruti-border)"
              stroke-width="12"
              stroke-dasharray="565 628"
              stroke-dashoffset="-31"
              stroke-linecap="round"
            />
            <!-- Active pitch arc -->
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
            <!-- Center markers (12 note positions) -->
            <g *ngFor="let angle of noteAngles; let i = index">
              <line
                [attr.x1]="120 + 84 * cos(angle)"
                [attr.y1]="120 + 84 * sin(angle)"
                [attr.x2]="120 + 92 * cos(angle)"
                [attr.y2]="120 + 92 * sin(angle)"
                stroke="var(--sruti-border)"
                stroke-width="2"
                stroke-linecap="round"
              />
            </g>
          </svg>

          <!-- Center Display -->
          <div class="pitch-center">
            <div class="note-name" [style.color]="meterColor">
              {{ currentPitch?.indianNote ?? '–' }}
            </div>
            <div class="hz-value" *ngIf="currentPitch">
              {{ currentPitch.frequency | number:'1.1-1' }} Hz
            </div>
            <div class="cents-badge"
              *ngIf="currentPitch"
              [class.sharp]="currentPitch.centsOff > 10"
              [class.flat]="currentPitch.centsOff < -10"
              [class.in-tune]="isInTune"
            >
              {{ currentPitch.centsOff > 0 ? '+' : '' }}{{ currentPitch.centsOff | number:'1.0-0' }}¢
            </div>
            <div class="no-pitch" *ngIf="!currentPitch && isActive">
              Sing...
            </div>
          </div>
        </div>

        <!-- Tuner Needle -->
        <div class="tuner-section" *ngIf="currentPitch">
          <div class="tuner-labels">
            <span>-50¢</span><span>-25¢</span><span>In Tune</span><span>+25¢</span><span>+50¢</span>
          </div>
          <div class="tuner-gauge">
            <div class="tuner-center-mark"></div>
            <div
              class="tuner-needle"
              [class.in-tune]="isInTune"
              [style.transform]="'translateX(-50%) rotate(' + needleAngle + 'deg)'"
            ></div>
          </div>
        </div>

        <!-- Accuracy Bar -->
        <div class="accuracy-section" *ngIf="currentPitch">
          <div class="accuracy-label">
            <span>Accuracy</span>
            <span class="accuracy-value" [style.color]="meterColor">
              {{ currentPitch.accuracy | number:'1.0-0' }}%
            </span>
          </div>
          <div class="sruti-progress-bar">
            <div
              class="progress-fill"
              [style.width]="currentPitch.accuracy + '%'"
              [style.background]="meterGradient"
            ></div>
          </div>
        </div>

        <!-- Note Grid (which notes have been detected) -->
        <div class="note-grid-section">
          <div class="section-title">Notes Detected</div>
          <div class="sruti-note-grid">
            <div
              *ngFor="let note of allNotes; let i = index"
              class="note-chip"
              [class.active]="detectedNotes.has(note)"
              [class.current]="currentPitch?.indianNote === note"
              [style.--note-color]="noteColors[i]"
            >
              <span class="note-name">{{ note }}</span>
            </div>
          </div>
        </div>

        <!-- Mic / Start Button -->
        <div class="mic-section">
          <button
            class="mic-btn"
            [class.is-active]="isActive"
            (click)="toggleMic()"
          >
            <ion-icon [name]="isActive ? 'mic' : 'mic-off'"></ion-icon>
            <span>{{ isActive ? 'Listening...' : 'Tap to Sing' }}</span>
          </button>

          <div class="waveform-bars" [class.silent]="!currentPitch">
            <div *ngFor="let _ of [1,2,3,4,5,6,7,8]" class="bar"></div>
          </div>
        </div>

        <!-- Stats Row -->
        <div class="stats-row" *ngIf="sessionStats.sampleCount > 0">
          <div class="sruti-stat-card">
            <div class="stat-value">{{ sessionStats.stabilityScore | number:'1.0-0' }}</div>
            <div class="stat-label">Stability</div>
          </div>
          <div class="sruti-stat-card">
            <div class="stat-value">{{ sessionStats.averageCentsOff | number:'1.0-0' }}¢</div>
            <div class="stat-label">Avg Deviation</div>
          </div>
          <div class="sruti-stat-card">
            <div class="stat-value">{{ sessionStats.sampleCount }}</div>
            <div class="stat-label">Notes</div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./sing.page.scss']
})
export class SingPage implements OnInit, OnDestroy {
  readonly allNotes: IndianNote[] = [
    'Sa','Re♭','Re','Ga♭','Ga','Ma','Ma#','Pa','Dha♭','Dha','Ni♭','Ni'
  ];
  readonly noteColors = [
    '#FF6B6B','#FF8E53','#FFC300','#A8FF78','#4CAF50',
    '#26C6DA','#7C4DFF','#2196F3','#9C27B0','#CE93D8','#E91E63','#FF80AB'
  ];
  readonly noteAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2 - Math.PI / 2);

  currentPitch: PitchResult | null = null;
  isActive  = false;
  detectedNotes = new Set<IndianNote>();
  sessionStats  = { sampleCount: 0, stabilityScore: 0, averageCentsOff: 0 };

  private destroy$ = new Subject<void>();

  get isInTune():    boolean { return this.currentPitch?.isInTune ?? false; }
  get meterColor():  string {
    if (!this.currentPitch) return 'var(--sruti-border)';
    if (this.isInTune) return 'var(--sruti-pitch-perfect)';
    if (Math.abs(this.currentPitch.centsOff) < 30) return 'var(--sruti-pitch-close)';
    return 'var(--sruti-pitch-off)';
  }
  get meterGradient(): string {
    return `linear-gradient(90deg, ${this.meterColor} 0%, ${this.meterColor} 100%)`;
  }
  get meterDash():   string {
    const pct = Math.min(1, (this.currentPitch?.accuracy ?? 0) / 100);
    return `${pct * 565} 628`;
  }
  get meterOffset(): string { return '-31'; }
  get needleAngle(): number {
    if (!this.currentPitch) return 0;
    return Math.max(-45, Math.min(45, this.currentPitch.centsOff * 0.9));
  }

  constructor(
    private pitchDetection: PitchDetectionService,
    private tanpura: TanpuraPlayerService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ mic, micOff, musicalNotes, statsChart });
  }

  ngOnInit(): void {
    this.pitchDetection.pitch$
      .pipe(takeUntil(this.destroy$), throttleTime(50))
      .subscribe(pitch => {
        this.currentPitch = pitch;
        if (pitch) this.detectedNotes.add(pitch.indianNote);
        this.cdr.markForCheck();
      });
  }

  async toggleMic(): Promise<void> {
    if (this.isActive) {
      this.pitchDetection.stop();
      this.sessionStats = this.pitchDetection.getSessionStats() as any;
      this.isActive = false;
    } else {
      await this.pitchDetection.start();
      this.detectedNotes.clear();
      this.isActive = true;
    }
    this.cdr.markForCheck();
  }

  cos(angle: number): number { return Math.cos(angle); }
  sin(angle: number): number { return Math.sin(angle); }

  ngOnDestroy(): void {
    this.pitchDetection.stop();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
