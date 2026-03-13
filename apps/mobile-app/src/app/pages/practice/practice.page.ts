import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { TrainingEngineService, TrainingMode, TrainingSessionResult } from '@voice-tuner/training-engine';
import { TanpuraPlayerService } from '@voice-tuner/tanpura-player';
import { PitchDetectionService, IndianNote } from '@voice-tuner/pitch-detection';
import { RAGA_LIST, RagaDefinition } from '@voice-tuner/training-engine';

@Component({
  selector: 'app-practice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Practice</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="practice-page">

        <!-- Mode Selector -->
        <ion-segment [(ngModel)]="selectedMode" class="mode-segment">
          <ion-segment-button value="shruti">
            <ion-label>Shruti</ion-label>
          </ion-segment-button>
          <ion-segment-button value="raga">
            <ion-label>Raga</ion-label>
          </ion-segment-button>
          <ion-segment-button value="free">
            <ion-label>Free</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- Shruti Trainer -->
        <div *ngIf="selectedMode === 'shruti'" class="shruti-section animate-fade-in">
          <div class="mode-card sruti-card">
            <div class="mode-card__title">Shruti Trainer</div>
            <div class="mode-card__desc">App plays Sa — you sing Sa. Match pitch perfectly.</div>
          </div>

          <div class="target-display" *ngIf="sessionActive">
            <div class="target-note">Sa</div>
            <div class="target-label">Target Note</div>
          </div>

          <div class="live-notes-section" *ngIf="sessionActive">
            <div class="live-label">You're Singing</div>
            <div class="live-note" [style.color]="liveNoteColor">
              {{ (liveNotes$ | async)?.[0] ?? '–' }}
            </div>
          </div>
        </div>

        <!-- Raga Practice -->
        <div *ngIf="selectedMode === 'raga'" class="raga-section animate-fade-in">
          <div class="raga-grid" *ngIf="!selectedRaga">
            <button
              *ngFor="let raga of ragaList"
              class="raga-card sruti-card"
              (click)="selectRaga(raga)"
            >
              <div class="raga-card__indicator" [style.background]="raga.color"></div>
              <div class="raga-card__content">
                <div class="raga-card__name">{{ raga.englishName }}</div>
                <div class="raga-card__hindi">{{ raga.name }}</div>
                <div class="raga-card__time">{{ raga.time }}</div>
              </div>
            </button>
          </div>

          <div class="raga-detail" *ngIf="selectedRaga">
            <div class="sruti-card raga-info-card">
              <div class="raga-info-header">
                <div class="raga-info-dot" [style.background]="selectedRaga.color"></div>
                <div>
                  <div class="raga-info-name">{{ selectedRaga.englishName }}</div>
                  <div class="raga-info-meta">{{ selectedRaga.thaat }} · {{ selectedRaga.time }}</div>
                </div>
                <button class="change-raga-btn" (click)="selectedRaga = null">Change</button>
              </div>
              <p class="raga-info-desc">{{ selectedRaga.description }}</p>
            </div>

            <!-- Allowed notes grid -->
            <div class="notes-section">
              <div class="notes-label">Raga Notes</div>
              <div class="sruti-note-grid">
                <div
                  *ngFor="let note of allNotes; let i = index"
                  class="note-chip"
                  [class.active]="isAllowed(note)"
                  [class.disallowed]="!isAllowed(note)"
                  [class.singing]="(liveNotes$ | async)?.includes(note)"
                >
                  <span class="note-name">{{ note }}</span>
                </div>
              </div>
            </div>

            <!-- Live disallowed alert -->
            <div
              class="disallowed-alert"
              *ngIf="lastDisallowedNote"
            >
              ⚠️ {{ lastDisallowedNote }} is not in {{ selectedRaga.englishName }}
            </div>
          </div>
        </div>

        <!-- Start / Stop -->
        <div class="session-controls">
          <button
            class="sruti-btn sruti-btn--primary session-btn"
            *ngIf="!sessionActive"
            (click)="startSession()"
            [disabled]="selectedMode === 'raga' && !selectedRaga"
          >
            Start Practice
          </button>
          <button
            class="sruti-btn sruti-btn--primary session-btn session-btn--stop"
            *ngIf="sessionActive"
            (click)="stopSession()"
          >
            End Session
          </button>
        </div>

        <!-- Session Result Cards -->
        <div class="result-section animate-slide-up" *ngIf="lastResult">
          <div class="result-header">Session Complete</div>
          <div class="stats-grid">
            <div class="sruti-stat-card">
              <div class="stat-value">{{ lastResult.overallAccuracy | number:'1.0-0' }}%</div>
              <div class="stat-label">Accuracy</div>
            </div>
            <div class="sruti-stat-card">
              <div class="stat-value">{{ lastResult.pitchStability | number:'1.0-0' }}</div>
              <div class="stat-label">Stability</div>
            </div>
            <div class="sruti-stat-card">
              <div class="stat-value">{{ lastResult.duration | number:'1.0-0' }}s</div>
              <div class="stat-label">Duration</div>
            </div>
          </div>

          <div class="recommendations" *ngIf="lastResult.recommendations.length">
            <div class="rec-header">AI Recommendations</div>
            <div
              *ngFor="let rec of lastResult.recommendations"
              class="rec-item sruti-card"
            >
              💡 {{ rec }}
            </div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./practice.page.scss']
})
export class PracticePage implements OnInit, OnDestroy {
  readonly ragaList  = RAGA_LIST;
  readonly allNotes: IndianNote[] = [
    'Sa','Re♭','Re','Ga♭','Ga','Ma','Ma#','Pa','Dha♭','Dha','Ni♭','Ni'
  ];

  selectedMode: TrainingMode = 'shruti';
  selectedRaga: RagaDefinition | null = null;
  sessionActive  = false;
  lastResult: TrainingSessionResult | null = null;
  lastDisallowedNote: IndianNote | null = null;

  liveNotes$ = this.trainingEngine.liveNotes$;

  private destroy$ = new Subject<void>();

  get liveNoteColor(): string {
    return 'var(--sruti-primary)';
  }

  constructor(
    private trainingEngine: TrainingEngineService,
    private tanpura: TanpuraPlayerService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.trainingEngine.liveNotes$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notes => {
        if (this.selectedRaga && notes.length) {
          const latest = notes[notes.length - 1];
          if (!this.selectedRaga.notes.includes(latest)) {
            this.lastDisallowedNote = latest;
            setTimeout(() => { this.lastDisallowedNote = null; this.cdr.markForCheck(); }, 2000);
          }
        }
        this.cdr.markForCheck();
      });
  }

  selectRaga(raga: RagaDefinition): void {
    this.selectedRaga = raga;
    this.cdr.markForCheck();
  }

  isAllowed(note: IndianNote): boolean {
    if (!this.selectedRaga) return true;
    return this.selectedRaga.notes.includes(note);
  }

  async startSession(): Promise<void> {
    await this.trainingEngine.startSession(this.selectedMode, this.selectedRaga ?? undefined);
    await this.tanpura.play();
    this.sessionActive = true;
    this.lastResult    = null;
    this.cdr.markForCheck();
  }

  stopSession(): void {
    this.lastResult   = this.trainingEngine.endSession();
    this.sessionActive = false;
    this.tanpura.stop();
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    if (this.sessionActive) this.stopSession();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
