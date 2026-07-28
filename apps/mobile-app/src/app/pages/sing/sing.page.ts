import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, throttleTime } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButton, IonIcon, ViewWillEnter, ViewWillLeave
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { DecimalPipe } from '@angular/common';
import { mic, micOff, statsChart } from 'ionicons/icons';
import { PitchDetectionService, PitchResult, IndianNote } from '@voice-tuner/pitch-detection';
import { TanpuraPlayerService } from '@voice-tuner/tanpura-player';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { AuthService } from '@voice-tuner/auth';
import { PermissionsService } from '../../core/services/permissions.service';

// ── Types ─────────────────────────────────────────────────

const INDIAN_NOTES: IndianNote[] = ['Sa','Re♭','Re','Ga♭','Ga','Ma','Ma#','Pa','Dha♭','Dha','Ni♭','Ni'];

const BUBBLE_WIDTH = 100;
const BUBBLE_HEIGHT = 44;
const BUBBLE_SPEED_MIN = 0.4;
const BUBBLE_SPEED_RANGE = 0.3;
const BUBBLE_SPAWN_MARGIN = 20;
const POP_ANIMATION_MS = 3000;

@Component({
  selector: 'app-sing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    DecimalPipe
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sing</ion-title>
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
            @if (isActive && targetNote && guidance && !isHit && !isPopping) {
            <div class="guidance-meter" [class.guidance-up]="guidance === 'higher'" [class.guidance-down]="guidance === 'lower'">
              @if (guidance === 'higher') { ↑ Raise frequency to hit {{ targetNote }} }
              @if (guidance === 'lower') { ↓ Lower frequency to hit {{ targetNote }} }
            </div>
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

        <!-- Bubble Game Area -->
        <div class="game-area" #gameArea>
          @if (isActive && targetNote) {
          <div
            class="bubble"
            [class.popping]="isPopping"
            [class.hit]="isHit"
            [style.transform]="'translate(' + bubbleX + 'px, ' + bubbleY + 'px)'"
          >
            <span class="bubble-note">{{ targetNote }}</span>
            @if (isHit) {
            <span class="bubble-countdown">Lock {{ countdown }}</span>
            }
          </div>
          } @else if (isActive && !targetNote) {
          <div class="game-idle">Get ready...</div>
          }
          @if (!isActive) {
          <div class="game-idle">Start singing to play</div>
          }
        </div>

        <!-- Score (logged-in only) -->
        @if (authService.currentUser && isActive) {
        <div class="score-row">
          <span class="score-item">✓ {{ correctCount }}/{{ totalCount }}</span>
          <span class="score-divider"></span>
          <span class="score-item">Streak {{ streak }}</span>
        </div>
        }

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
export class SingPage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  currentPitch:  PitchResult | null = null;
  isActive       = false;
  detectedNotes  = new Set<IndianNote>();
  sessionStats   = { sampleCount: 0, stabilityScore: 0, averageCentsOff: 0 };
  micError:      string | null = null;
  micPermDenied  = false;

  // ── Game state ───────────────────────────────────────────
  targetNote: IndianNote | null = null;
  correctCount = 0;
  totalCount = 0;
  streak = 0;
  bubbleX = 150;
  bubbleY = 100;
  bubbleVx = 1.5;
  bubbleVy = 1.2;
  isPopping = false;
  isHit = false;
  countdown = 0;
  guidance: '' | 'higher' | 'lower' = '';
  readonly noteAngles = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2 - Math.PI / 2);
  private animFrameId: number | null = null;
  private gameAreaEl: HTMLElement | null = null;

  @ViewChild('gameArea', { static: false }) set gameAreaRef(el: ElementRef<HTMLElement>) {
    if (el) this.gameAreaEl = el.nativeElement;
  }

  scaleNoteSet: Set<IndianNote> = new Set(INDIAN_NOTES); // all 12 notes

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
  private readonly _icons = (() => addIcons({ mic, micOff, statsChart }))();

  ngOnInit(): void {
    this.pitchDetection.pitch$
      .pipe(takeUntil(this.destroy$), throttleTime(50))
      .subscribe(pitch => {
        this.currentPitch = pitch;
        if (pitch) this.detectedNotes.add(pitch.indianNote);
        if (pitch && this.targetNote && this.isActive && !this.isPopping && !this.isHit) {
          if (pitch.indianNote === this.targetNote && pitch.isInTune) {
            this.totalCount++;
            this.streak++;
            this.correctCount++;
            this.guidance = '';
            this.isHit = true;
            this.countdown = 3;
            this.stopBounceLoop();
            const countdownId = setInterval(() => {
              this.countdown--;
              if (this.countdown <= 0) {
                clearInterval(countdownId);
                this.isHit = false;
                this.isPopping = true;
                setTimeout(() => {
                  this.isPopping = false;
                  this.pickRandomNote();
                }, 400);
              }
              try { this.cdr.markForCheck(); } catch {}
            }, 1000);
          } else {
            if (pitch.indianNote !== this.targetNote) {
              const targetIdx = INDIAN_NOTES.indexOf(this.targetNote);
              const pitchIdx = INDIAN_NOTES.indexOf(pitch.indianNote);
              this.guidance = pitchIdx < targetIdx ? 'higher' : 'lower';
            } else {
              this.guidance = '';
            }
          }
        }
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

  // Stop mic/pitch detection when user navigates away from this tab.
  // ion-tabs caches pages in the DOM so ngOnDestroy does NOT fire on tab switch.
  ionViewWillLeave(): void {
    if (this.isActive) {
      this.pitchDetection.stop();
      const stats = this.pitchDetection.getSessionStats();
      this.sessionStats = stats as any;
      this.isActive = false;
      this.stopBounceLoop();
      this.targetNote = null;
      this.guidance = '';
      this.isPopping = false;
      this.isHit = false;
      this.countdown = 0;
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
      this.cdr.markForCheck();
    }
  }

  // ── Bubble game ──────────────────────────────────────────
  private pickRandomNote(): void {
    const scaleNotes = Array.from(this.scaleNoteSet);
    if (scaleNotes.length === 0) return;
    const idx = Math.floor(Math.random() * scaleNotes.length);
    this.targetNote = scaleNotes[idx];
    this.guidance = '';
    this.spawnBubble();
  }

  private spawnBubble(): void {
    if (!this.gameAreaEl) return;
    const rect = this.gameAreaEl.getBoundingClientRect();
    this.bubbleX = BUBBLE_SPAWN_MARGIN + Math.random() * (rect.width - BUBBLE_WIDTH - BUBBLE_SPAWN_MARGIN);
    this.bubbleY = BUBBLE_SPAWN_MARGIN + Math.random() * (rect.height - BUBBLE_HEIGHT - BUBBLE_SPAWN_MARGIN);
    const angle = Math.random() * Math.PI * 2;
    const speed = BUBBLE_SPEED_MIN + Math.random() * BUBBLE_SPEED_RANGE;
    this.bubbleVx = Math.cos(angle) * speed;
    this.bubbleVy = Math.sin(angle) * speed;
    this.cdr.markForCheck();
    this.startBounceLoop();
  }

  private startBounceLoop(): void {
    if (this.animFrameId !== null) return;
    const loop = () => {
      if (!this.isActive || this.isPopping || !this.gameAreaEl) {
        this.animFrameId = null;
        return;
      }
      this.bubbleX += this.bubbleVx;
      this.bubbleY += this.bubbleVy;
      const rect = this.gameAreaEl.getBoundingClientRect();
      const bubbleW = BUBBLE_WIDTH;
      const bubbleH = BUBBLE_HEIGHT;
      if (this.bubbleX <= 0) { this.bubbleX = 0; this.bubbleVx = Math.abs(this.bubbleVx); }
      if (this.bubbleX >= rect.width - bubbleW) { this.bubbleX = rect.width - bubbleW; this.bubbleVx = -Math.abs(this.bubbleVx); }
      if (this.bubbleY <= 0) { this.bubbleY = 0; this.bubbleVy = Math.abs(this.bubbleVy); }
      if (this.bubbleY >= rect.height - bubbleH) { this.bubbleY = rect.height - bubbleH; this.bubbleVy = -Math.abs(this.bubbleVy); }
      try { this.cdr.markForCheck(); } catch {}
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopBounceLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // ── Mic toggle ───────────────────────────────────────────
  async toggleMic(): Promise<void> {
    if (this.isActive) {
      this.pitchDetection.stop();
      const stats = this.pitchDetection.getSessionStats();
      this.sessionStats = stats as any;
      this.isActive = false;
      this.stopBounceLoop();
      this.targetNote = null;
      this.guidance = '';
      this.isPopping = false;
      this.isHit = false;
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
        this.correctCount = 0;
        this.totalCount = 0;
        this.streak = 0;
        this.isPopping = false;
        this.isHit = false;
        this.countdown = 0;
        this.isActive = true;
        this.pickRandomNote();
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
