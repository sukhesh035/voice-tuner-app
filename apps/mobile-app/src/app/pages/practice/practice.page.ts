import {
  Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { TrainingEngineService, TrainingMode, TrainingSessionResult } from '@voice-tuner/training-engine';
import { TanpuraPlayerService, MusicalKey } from '@voice-tuner/tanpura-player';
import { PitchDetectionService, IndianNote, PitchResult } from '@voice-tuner/pitch-detection';
import {
  RAGA_LIST, MELAKARTA_LIST, MELAKARTA_CHAKRAS,
  RagaDefinition, MelakartaChakra
} from '@voice-tuner/training-engine';
import { ApiService } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';

/** Phases of a single Shruti round */
export type ShrutiPhase = 'idle' | 'playing' | 'ready' | 'listening' | 'result';

/**
 * Phases of whole-raga practice:
 *   idle     → not started
 *   playback → app plays the entire raga (aroh then avaroh) note by note
 *   practice → mic opens, user sings the raga freely
 *   result   → analysis of what the user sang
 */
export type RagaPhase = 'idle' | 'playback' | 'practice' | 'result';

/**
 * Phases of an Ear Training round:
 *   idle     → not started / intro screen
 *   playing  → app plays a random note (~2.5 s)
 *   guessing → user picks from the 12-note grid
 *   reveal   → show correct/wrong feedback
 */
export type EarPhase = 'idle' | 'playing' | 'guessing' | 'reveal';

// How long (ms) the tanpura plays the target note before stopping
const PLAY_DURATION_MS = 2500;
// Silence gap after tanpura stops — lets oscillator tails & room echo die out
const REVERB_GAP_MS = 900;
// Discard pitch samples for this long after mic opens (catches any residual reverb)
const MIC_WARMUP_MS = 300;
// How long (ms) the mic actively listens
const LISTEN_DURATION_MS = 5000;

// ── BPM-derived timing for raga practice ─────────────────
const RAGA_DEFAULT_BPM = 40;
// Minimum ms per note during playback (even at high BPM)
const RAGA_MIN_NOTE_MS = 600;
// Gap between playback ending and practice mic opening
const RAGA_READY_GAP_MS = 1500;
// Practice duration multiplier: practice time = total playback time × this factor
const RAGA_PRACTICE_MULTIPLIER = 1.5;
// Minimum practice duration regardless of BPM
const RAGA_MIN_PRACTICE_MS = 10000;

/** Returns ms per note during the playback phase for a given BPM. */
function ragaBeatMs(bpm: number): number {
  if (bpm <= 0) return 2000; // default pace when manual
  return Math.max(RAGA_MIN_NOTE_MS, Math.round(60000 / bpm));
}

// The 12 Indian notes in semitone order (0 = Sa = C in default tuning).
const ALL_SHRUTI_NOTES: IndianNote[] = [
  'Sa', 'Re♭', 'Re', 'Ga♭', 'Ga', 'Ma', 'Ma#', 'Pa', 'Dha♭', 'Dha', 'Ni♭', 'Ni'
];

// Western key names in semitone order from C — used to tune the tanpura to the
// target note so the drone rings on exactly that pitch.
const SEMITONE_TO_KEY: MusicalKey[] = [
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'
];

interface RoundPitchSample {
  note:     IndianNote;
  accuracy: number;
  centsOff: number;
}

// ── Feedback generation ──────────────────────────────────────────────────────

/**
 * Returns a natural-language response based on what the user sang vs what
 * was asked. Considers: correct/wrong note, direction of error, and accuracy %.
 */
function buildFeedback(
  targetNote: IndianNote,
  samples:    RoundPitchSample[],
  accuracy:   number
): string {
  if (samples.length === 0) {
    return "Hmm, I didn't hear you sing. Give it another try — sing clearly into the mic.";
  }

  // Find the note the user sang most often
  const noteCounts: Partial<Record<IndianNote, number>> = {};
  for (const s of samples) {
    noteCounts[s.note] = (noteCounts[s.note] ?? 0) + 1;
  }
  const sungNote = (Object.entries(noteCounts) as [IndianNote, number][])
    .sort((a, b) => b[1] - a[1])[0][0];

  // Average cents deviation (negative = flat, positive = sharp)
  const avgCents  = samples.reduce((s, p) => s + p.centsOff, 0) / samples.length;
  const absCents  = Math.abs(avgCents);
  const direction = avgCents > 0 ? 'sharp' : 'flat';
  const wrongNote = sungNote !== targetNote;

  // ── Wrong note entirely ──
  if (wrongNote) {
    const targetIdx = ALL_SHRUTI_NOTES.indexOf(targetNote);
    const sungIdx   = ALL_SHRUTI_NOTES.indexOf(sungNote);
    const diff      = sungIdx - targetIdx;
    const absDiff   = Math.abs(diff);

    if (absDiff === 1) {
      const dir = diff > 0 ? 'slightly higher' : 'slightly lower';
      return `Close! You sang ${sungNote} — that's just one note ${dir} than ${targetNote}. Nudge your pitch ${diff > 0 ? 'down' : 'up'} a little and try again.`;
    }
    if (absDiff === 2) {
      const dir = diff > 0 ? 'higher' : 'lower';
      return `You sang ${sungNote} instead of ${targetNote}. Move your pitch ${diff > 0 ? 'lower' : 'higher'} by a step — you're in the right neighbourhood.`;
    }
    return `The target was ${targetNote} but you landed on ${sungNote}. Take a moment to really absorb the sound before you sing — focus on matching that exact pitch.`;
  }

  // ── Correct note, judge accuracy ──
  if (accuracy >= 92) {
    return `Spot on ${targetNote}! ${accuracy}% — that was clean and centred. Your pitch memory is strong here.`;
  }
  if (accuracy >= 80) {
    if (absCents < 10) {
      return `Good ${targetNote}! ${accuracy}% — you're right there, just a hair ${direction}. Steady breath and you'll lock it in.`;
    }
    return `Nice ${targetNote}! ${accuracy}% accuracy. You're drifting about ${absCents.toFixed(0)} cents ${direction} — bring it in just a touch.`;
  }
  if (accuracy >= 65) {
    if (absCents > 20) {
      return `You found ${targetNote} but you're sitting ${absCents.toFixed(0)} cents ${direction}. Relax the throat, support from the diaphragm, and ease ${direction === 'sharp' ? 'down' : 'up'} slightly.`;
    }
    return `You're on ${targetNote} but the pitch is wandering — ${accuracy}%. Try to land on it and hold steady rather than searching for it while you sing.`;
  }
  // Below 65%
  if (absCents > 30) {
    return `You got ${targetNote} but you're quite ${direction} — about ${absCents.toFixed(0)} cents off. Breathe, internalise the sound you just heard, then come in softly and settle.`;
  }
  return `You sang ${targetNote} but it's unstable at ${accuracy}%. Try humming the note first before opening up to your full voice.`;
}

@Component({
  selector: 'app-practice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
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
            <ion-label>Ear Training</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- ── Shruti Trainer ──────────────────────────────── -->
        <div *ngIf="selectedMode === 'shruti'" class="shruti-section animate-fade-in">
          <div class="mode-card sruti-card">
            <div class="mode-card__title">Shruti Trainer</div>
            <div class="mode-card__desc">App plays a note — then you sing it back. Match pitch perfectly.</div>
          </div>

          <!-- Phase: PLAYING -->
          <div class="phase-display phase-playing" *ngIf="shrutiPhase === 'playing'">
            <div class="phase-icon">&#9654;</div>
            <div class="phase-note">{{ currentTargetNote }}</div>
            <div class="phase-label">Listen to the note&hellip;</div>
            <div class="phase-hint">Mic is off &mdash; just listen</div>
          </div>

          <!-- Phase: READY (silence gap) -->
          <div class="phase-display phase-ready" *ngIf="shrutiPhase === 'ready'">
            <div class="phase-icon ready-icon">&#8987;</div>
            <div class="phase-note">{{ currentTargetNote }}</div>
            <div class="phase-label">Get ready to sing&hellip;</div>
            <div class="phase-hint">Mic opens in a moment</div>
          </div>

          <!-- Phase: LISTENING -->
          <div class="phase-display phase-listening" *ngIf="shrutiPhase === 'listening'">
            <div class="phase-icon pulse-icon">&#9679;</div>
            <div class="phase-note">{{ currentTargetNote }}</div>
            <div class="phase-label">Now sing <strong>{{ currentTargetNote }}</strong></div>
            <div class="live-pitch-row">
              <span class="live-pitch-note" [class.on-target]="liveNote === currentTargetNote">
                {{ liveNote ?? '&ndash;' }}
              </span>
              <span class="live-pitch-accuracy" *ngIf="currentAccuracy !== null">
                {{ currentAccuracy | number:'1.0-0' }}%
              </span>
            </div>
            <div class="phase-hint">Mic is active &mdash; sing now</div>
          </div>

          <!-- Phase: RESULT -->
          <div class="phase-display phase-result" *ngIf="shrutiPhase === 'result'">
            <div class="result-notes-compared">
              <div class="result-note-block">
                <div class="result-note-label">Target</div>
                <div class="result-note-value">{{ currentTargetNote }}</div>
              </div>
              <div class="result-arrow">&#8594;</div>
              <div class="result-note-block">
                <div class="result-note-label">You sang</div>
                <div class="result-note-value"
                  [class.note-match]="roundSungNote === currentTargetNote"
                  [class.note-miss]="roundSungNote !== currentTargetNote && roundSungNote !== null">
                  {{ roundSungNote ?? '&ndash;' }}
                </div>
              </div>
              <div class="round-accuracy-badge"
                [class.good]="roundAccuracy >= 70"
                [class.great]="roundAccuracy >= 90">
                {{ roundAccuracy }}%
              </div>
            </div>
            <div class="round-feedback">{{ roundFeedback }}</div>
            <div class="phase-hint">Tap "Next Note" to continue</div>
          </div>

          <!-- Round controls -->
          <div class="shruti-round-controls" *ngIf="sessionActive">
            <button
              class="sruti-btn sruti-btn--secondary round-btn"
              *ngIf="shrutiPhase === 'result'"
              (click)="nextShrutiRound()"
            >
              Next Note
            </button>
            <div class="round-status-pill" *ngIf="shrutiPhase === 'playing'">
              <span class="pill-dot playing-dot"></span>Playing
            </div>
            <div class="round-status-pill" *ngIf="shrutiPhase === 'ready'">
              <span class="pill-dot ready-dot"></span>Get ready&hellip;
            </div>
            <div class="round-status-pill" *ngIf="shrutiPhase === 'listening'">
              <span class="pill-dot listening-dot"></span>Listening
            </div>
          </div>
        </div>

        <!-- ── Raga Practice ───────────────────────────────── -->
        <div *ngIf="selectedMode === 'raga'" class="raga-section animate-fade-in">

          <!-- Raga Browser -->
          <div class="raga-browser" *ngIf="!selectedRaga">

            <!-- Popular Ragas -->
            <div class="raga-browser-section">
              <div class="raga-section-header">Popular Ragas</div>
              <div class="popular-ragas-row">
                <button
                  *ngFor="let raga of popularRagas"
                  class="popular-raga-card"
                  (click)="selectRaga(raga)"
                >
                  <div class="popular-raga-card__dot" [style.background]="raga.color"></div>
                  <div class="popular-raga-card__name">{{ raga.englishName }}</div>
                  <div class="popular-raga-card__time">{{ raga.time }}</div>
                </button>
              </div>
            </div>

            <!-- 72 Melakartas -->
            <div class="raga-browser-section">
              <div class="raga-section-header">72 Melakarta Ragas</div>

              <!-- Search bar -->
              <div class="raga-search">
                <input
                  type="text"
                  class="raga-search__input"
                  placeholder="Search by name, number, or chakra..."
                  [(ngModel)]="ragaSearchQuery"
                  (ngModelChange)="filterRagas()"
                />
                <span class="raga-search__icon">&#128269;</span>
              </div>

              <!-- Chakra filter chips -->
              <div class="chakra-filter">
                <button
                  class="chakra-chip"
                  [class.chakra-chip--active]="!selectedChakra"
                  (click)="selectChakra(null)"
                >
                  All <span class="chakra-chip__count">72</span>
                </button>
                <button
                  *ngFor="let ch of chakras"
                  class="chakra-chip"
                  [class.chakra-chip--active]="selectedChakra === ch.name"
                  (click)="selectChakra(ch.name)"
                >
                  {{ ch.name }}
                  <span class="chakra-chip__range">{{ ch.range[0] }}&ndash;{{ ch.range[1] }}</span>
                </button>
              </div>

              <!-- Melakarta raga list -->
              <div class="raga-list">
                <button
                  *ngFor="let raga of filteredRagas"
                  class="raga-card"
                  (click)="selectRaga(raga)"
                >
                  <div class="raga-card__mela"
                    [style.background]="raga.color"
                  >{{ raga.melaNumber }}</div>
                  <div class="raga-card__content">
                    <div class="raga-card__name">{{ raga.englishName }}</div>
                    <div class="raga-card__hindi">{{ raga.name }}</div>
                    <div class="raga-card__meta">
                      <span class="raga-card__time">{{ raga.time }}</span>
                      <span class="raga-card__mood" *ngIf="raga.mood">{{ raga.mood }}</span>
                    </div>
                  </div>
                  <div class="raga-card__arrow">&#8250;</div>
                </button>
                <div class="raga-list-empty" *ngIf="filteredRagas.length === 0">
                  No ragas match your search.
                </div>
              </div>
            </div>
          </div>

          <!-- Raga Detail -->
          <div class="raga-detail" *ngIf="selectedRaga">
            <div class="sruti-card raga-info-card">
              <div class="raga-info-header">
                <div class="raga-info-mela" *ngIf="selectedRaga.melaNumber"
                  [style.background]="selectedRaga.color">
                  {{ selectedRaga.melaNumber }}
                </div>
                <div class="raga-info-dot" *ngIf="!selectedRaga.melaNumber"
                  [style.background]="selectedRaga.color"></div>
                <div class="raga-info-titles">
                  <div class="raga-info-name">{{ selectedRaga.englishName }}</div>
                  <div class="raga-info-hindi">{{ selectedRaga.name }}</div>
                  <div class="raga-info-meta">
                    {{ selectedRaga.thaat }}
                    <span *ngIf="selectedRaga.chakra"> &middot; {{ selectedRaga.chakra }} Chakra</span>
                    &middot; {{ selectedRaga.time }}
                  </div>
                </div>
                <button class="change-raga-btn" (click)="clearRaga()" *ngIf="!sessionActive">Change</button>
              </div>
              <div class="raga-mood-badge" *ngIf="selectedRaga.mood">{{ selectedRaga.mood }}</div>
              <p class="raga-info-desc">{{ selectedRaga.description }}</p>
            </div>

            <!-- BPM Tempo Control -->
            <div class="raga-bpm-control" *ngIf="!sessionActive || ragaPhase === 'idle'">
              <div class="bpm-header">
                <span class="bpm-label">Tempo</span>
                <span class="bpm-value">{{ ragaBpm === 0 ? 'Manual' : ragaBpm + ' BPM' }}</span>
              </div>
              <input
                type="range"
                class="bpm-slider"
                [min]="0"
                [max]="120"
                [step]="5"
                [value]="ragaBpm"
                (input)="onBpmChange($any($event.target).value)"
                [disabled]="sessionActive"
              />
              <div class="bpm-labels">
                <span>Manual</span>
                <span>Slow</span>
                <span>Medium</span>
                <span>Fast</span>
              </div>
            </div>

            <!-- Aroh / Avaroh with progress highlight -->
            <div class="raga-sequence-section">
              <div class="sequence-row">
                <div class="sequence-label" [class.sequence-label--active]="sessionActive && ragaSequencePart === 'aroh'">Aroh</div>
                <div class="sequence-notes">
                  <span
                    *ngFor="let note of selectedRaga.aroh; let i = index; let last = last"
                    class="seq-note"
                    [class.seq-note--vadi]="note === selectedRaga.vadi"
                    [class.seq-note--samvadi]="note === selectedRaga.samvadi"
                    [class.seq-note--singing]="sessionActive && ragaPhase === 'practice' && liveNote === note"
                    [class.seq-note--current]="sessionActive && ragaPhase === 'playback' && ragaSequencePart === 'aroh' && i === ragaPlaybackIndex"
                    [class.seq-note--done]="sessionActive && ragaPhase === 'playback' && (ragaSequencePart === 'avaroh' || (ragaSequencePart === 'aroh' && i < ragaPlaybackIndex))"
                  >
                    {{ note }}<span class="seq-arrow" *ngIf="!last"> &rarr; </span>
                  </span>
                </div>
              </div>
              <div class="sequence-row">
                <div class="sequence-label" [class.sequence-label--active]="sessionActive && ragaSequencePart === 'avaroh'">Avaroh</div>
                <div class="sequence-notes">
                  <span
                    *ngFor="let note of selectedRaga.avaroh; let i = index; let last = last"
                    class="seq-note"
                    [class.seq-note--vadi]="note === selectedRaga.vadi"
                    [class.seq-note--samvadi]="note === selectedRaga.samvadi"
                    [class.seq-note--singing]="sessionActive && ragaPhase === 'practice' && liveNote === note"
                    [class.seq-note--current]="sessionActive && ragaPhase === 'playback' && ragaSequencePart === 'avaroh' && i === (ragaPlaybackIndex - selectedRaga.aroh.length)"
                    [class.seq-note--done]="sessionActive && ragaPhase === 'playback' && ragaSequencePart === 'avaroh' && i < (ragaPlaybackIndex - selectedRaga.aroh.length)"
                  >
                    {{ note }}<span class="seq-arrow" *ngIf="!last"> &rarr; </span>
                  </span>
                </div>
              </div>
              <div class="vadi-legend">
                <span class="legend-item"><span class="legend-dot legend-dot--vadi"></span>Vadi ({{ selectedRaga.vadi }})</span>
                <span class="legend-item"><span class="legend-dot legend-dot--samvadi"></span>Samvadi ({{ selectedRaga.samvadi }})</span>
              </div>
            </div>

            <!-- Playback progress indicator -->
            <div class="raga-progress" *ngIf="sessionActive && ragaPhase === 'playback'">
              <div class="raga-progress-bar">
                <div class="raga-progress-fill"
                  [style.width.%]="(ragaPlaybackIndex / ragaNoteSequence.length) * 100"></div>
              </div>
              <div class="raga-progress-text">
                Note {{ ragaPlaybackIndex + 1 }} of {{ ragaNoteSequence.length }}
                &middot; {{ ragaSequencePart === 'aroh' ? 'Ascending' : 'Descending' }}
              </div>
            </div>

            <!-- Raga Phase: PLAYBACK (listen to the entire raga) -->
            <div class="phase-display phase-playing raga-phase" *ngIf="sessionActive && ragaPhase === 'playback'">
              <div class="phase-icon">&#9654;</div>
              <div class="phase-note">{{ currentTargetNote }}</div>
              <div class="phase-label">Listen to the raga&hellip;</div>
              <div class="phase-hint">Mic is off &mdash; just listen to each note</div>
            </div>

            <!-- Raga Phase: PRACTICE (user sings freely) -->
            <div class="phase-display phase-listening raga-phase" *ngIf="sessionActive && ragaPhase === 'practice'">
              <div class="phase-icon pulse-icon">&#9679;</div>
              <div class="phase-label">Now sing the raga</div>
              <div class="live-pitch-row">
                <span class="live-pitch-note" [class.on-target]="liveNote && selectedRaga.notes.includes(liveNote)">
                  {{ liveNote ?? '&ndash;' }}
                </span>
                <span class="live-pitch-accuracy" *ngIf="currentAccuracy !== null">
                  {{ currentAccuracy | number:'1.0-0' }}%
                </span>
              </div>
              <div class="raga-practice-countdown">
                {{ ragaPracticeCountdown }}s remaining
              </div>
              <div class="phase-hint">Mic is active &mdash; sing aroh then avaroh</div>
            </div>

            <!-- Raga Phase: RESULT (analysis breakdown) -->
            <div class="raga-result-section" *ngIf="sessionActive && ragaPhase === 'result'">
              <!-- Overall accuracy -->
              <div class="raga-result-overall">
                <div class="raga-result-accuracy-circle"
                  [class.good]="ragaOverallAccuracy >= 60 && ragaOverallAccuracy < 85"
                  [class.great]="ragaOverallAccuracy >= 85">
                  {{ ragaOverallAccuracy }}%
                </div>
                <div class="raga-result-title">Overall Accuracy</div>
              </div>

              <!-- Per-note breakdown grid -->
              <div class="raga-note-breakdown">
                <div class="raga-note-breakdown-header">Note Breakdown</div>
                <div class="raga-note-breakdown-grid">
                  <div
                    *ngFor="let nr of ragaNoteResults"
                    class="raga-note-result"
                    [class.raga-note-result--hit]="nr.hit"
                    [class.raga-note-result--miss]="!nr.hit"
                  >
                    <div class="raga-note-result__name">{{ nr.note }}</div>
                    <div class="raga-note-result__accuracy" *ngIf="nr.count > 0">{{ nr.accuracy }}%</div>
                    <div class="raga-note-result__status">{{ nr.hit ? 'Hit' : 'Missed' }}</div>
                  </div>
                </div>
              </div>

              <!-- Wrong notes (not in the raga) -->
              <div class="raga-wrong-notes" *ngIf="ragaWrongNotes.length > 0">
                <div class="raga-wrong-notes-header">Notes outside the raga</div>
                <div class="raga-wrong-notes-list">
                  <span *ngFor="let wn of ragaWrongNotes" class="raga-wrong-note-chip">{{ wn }}</span>
                </div>
              </div>

              <!-- Summary feedback -->
              <div class="raga-result-feedback">{{ ragaResultSummary }}</div>

              <!-- Action buttons -->
              <div class="raga-result-actions">
                <button class="sruti-btn sruti-btn--primary round-btn" (click)="practiceRagaAgain()">
                  Practice Again
                </button>
                <button class="sruti-btn sruti-btn--secondary round-btn" (click)="stopSession()">
                  Change Raga
                </button>
              </div>
            </div>

            <!-- Round controls during playback/practice -->
            <div class="shruti-round-controls" *ngIf="sessionActive && (ragaPhase === 'playback' || ragaPhase === 'practice')">
              <div class="round-status-pill" *ngIf="ragaPhase === 'playback'">
                <span class="pill-dot playing-dot"></span>Playing raga
              </div>
              <div class="round-status-pill" *ngIf="ragaPhase === 'practice'">
                <span class="pill-dot listening-dot"></span>Listening
              </div>
            </div>

            <!-- Note Grid (when not actively in a phase) -->
            <div class="notes-section" *ngIf="!sessionActive || ragaPhase === 'idle'">
              <div class="notes-label">Raga Notes</div>
              <div class="sruti-note-grid">
                <div
                  *ngFor="let note of allNotes; let i = index"
                  class="note-chip"
                  [class.active]="isAllowed(note)"
                  [class.disallowed]="!isAllowed(note)"
                  [class.vadi-highlight]="selectedRaga && note === selectedRaga.vadi"
                  [class.samvadi-highlight]="selectedRaga && note === selectedRaga.samvadi"
                  [class.singing]="(liveNotes$ | async)?.includes(note)"
                >
                  <span class="note-name">{{ note }}</span>
                  <span class="note-role" *ngIf="note === selectedRaga.vadi">V</span>
                  <span class="note-role" *ngIf="note === selectedRaga.samvadi">S</span>
                </div>
              </div>
            </div>

            <div class="disallowed-alert" *ngIf="lastDisallowedNote">
              {{ lastDisallowedNote }} is not in {{ selectedRaga.englishName }}
            </div>
          </div>
        </div>

        <!-- ── Ear Training ────────────────────────────────── -->
        <div *ngIf="selectedMode === 'free'" class="ear-section animate-fade-in">

          <!-- Intro card (before session starts) -->
          <div class="sruti-card ear-intro" *ngIf="!sessionActive">
            <div class="ear-intro__title">Ear Training</div>
            <div class="ear-intro__desc">
              Test your note recognition. The app plays a random note &mdash; can you identify it?
            </div>
            <div class="ear-intro__steps">
              <div class="ear-step">
                <div class="ear-step__num">1</div>
                <span>Listen to the note the app plays</span>
              </div>
              <div class="ear-step">
                <div class="ear-step__num">2</div>
                <span>Tap the note you think it is</span>
              </div>
              <div class="ear-step">
                <div class="ear-step__num">3</div>
                <span>See if you got it right!</span>
              </div>
            </div>
          </div>

          <!-- Score bar (during session) -->
          <div class="sruti-card ear-scorebar" *ngIf="sessionActive">
            <div class="ear-scorebar__item">
              <div class="ear-scorebar__value">{{ earScore }}</div>
              <div class="ear-scorebar__label">Score</div>
            </div>
            <div class="ear-scorebar__divider"></div>
            <div class="ear-scorebar__item">
              <div class="ear-scorebar__value">{{ earStreak }}</div>
              <div class="ear-scorebar__label">Streak</div>
            </div>
            <div class="ear-scorebar__divider"></div>
            <div class="ear-scorebar__item">
              <div class="ear-scorebar__value">{{ earRound }}</div>
              <div class="ear-scorebar__label">Round</div>
            </div>
          </div>

          <!-- Phase: PLAYING (note is sounding) -->
          <div class="ear-phase-display phase-playing" *ngIf="sessionActive && earPhase === 'playing'">
            <div class="ear-wave">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="ear-phase-label">Listening&hellip;</div>
            <div class="ear-phase-hint">A note is playing &mdash; listen carefully</div>
          </div>

          <!-- Phase: GUESSING (user picks a note) -->
          <div class="ear-phase-display phase-guessing" *ngIf="sessionActive && earPhase === 'guessing'">
            <div class="ear-question-mark">?</div>
            <div class="ear-phase-label">Which note was it?</div>
            <div class="ear-note-grid">
              <button
                *ngFor="let note of allNotes"
                class="ear-note-btn"
                (click)="onEarGuess(note)"
              >
                {{ note }}
              </button>
            </div>
            <button class="ear-replay-btn" (click)="replayEarNote()">
              &#9654; Replay
            </button>
          </div>

          <!-- Phase: REVEAL (correct or wrong) -->
          <div
            class="ear-phase-display"
            [ngClass]="earIsCorrect ? 'phase-correct' : 'phase-wrong'"
            *ngIf="sessionActive && earPhase === 'reveal'"
          >
            <div class="ear-feedback-icon" [ngClass]="earIsCorrect ? 'correct-icon' : 'wrong-icon'">
              {{ earIsCorrect ? '\u2713' : '\u2717' }}
            </div>
            <div class="ear-reveal-note">{{ earTargetNote }}</div>
            <div class="ear-phase-label">
              {{ earIsCorrect ? 'Correct!' : 'The note was ' + earTargetNote }}
            </div>

            <!-- Show note grid with highlights -->
            <div class="ear-note-grid">
              <button
                *ngFor="let note of allNotes"
                class="ear-note-btn"
                [ngClass]="getEarBtnClass(note)"
                disabled
              >
                {{ note }}
              </button>
            </div>

            <div class="ear-next-row">
              <button class="sruti-btn sruti-btn--primary round-btn" (click)="nextEarRound()">
                Next Round
              </button>
            </div>
          </div>

        </div>

        <!-- ── Start / Stop ────────────────────────────────── -->
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

        <!-- ── Session Result Cards ────────────────────────── -->
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
            <div class="rec-header">Recommendations</div>
            <div
              *ngFor="let rec of lastResult.recommendations"
              class="rec-item sruti-card"
            >
              &#128161; {{ rec }}
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
  readonly melakartaRagas = MELAKARTA_LIST;
  readonly popularRagas = RAGA_LIST.filter(r => r.melaNumber == null);
  readonly allNotes: IndianNote[] = [
    'Sa','Re♭','Re','Ga♭','Ga','Ma','Ma#','Pa','Dha♭','Dha','Ni♭','Ni'
  ];
  readonly chakras = MELAKARTA_CHAKRAS;

  selectedMode: TrainingMode = 'shruti';
  selectedRaga: RagaDefinition | null = null;
  sessionActive  = false;
  lastResult: TrainingSessionResult | null = null;
  lastDisallowedNote: IndianNote | null = null;

  // ── Raga browser state ──
  ragaSearchQuery = '';
  selectedChakra: MelakartaChakra | null = null;
  filteredRagas: RagaDefinition[] = MELAKARTA_LIST;

  // ── Shruti round state ──
  shrutiPhase: ShrutiPhase = 'idle';
  currentTargetNote: IndianNote = 'Sa';
  liveNote: IndianNote | null = null;
  currentAccuracy: number | null = null;
  roundAccuracy   = 0;
  roundSungNote: IndianNote | null = null;
  roundFeedback   = '';

  private accuracySamples: RoundPitchSample[] = [];
  /** Shuffled queue of notes not yet played this cycle */
  private notePool: IndianNote[] = [];
  /** All round accuracies collected across the shruti session (for session-level score) */
  private shrutiRoundScores: number[] = [];
  /** Timestamp when the shruti session started (for computing duration) */
  private shrutiSessionStart = 0;

  // ── Raga practice state ──
  ragaPhase: RagaPhase = 'idle';
  ragaBpm = RAGA_DEFAULT_BPM;
  ragaNoteSequence: IndianNote[] = [];
  /** Index of the note currently being played during the playback phase */
  ragaPlaybackIndex = 0;
  /** 'aroh' or 'avaroh' — which half of the sequence is currently highlighted */
  ragaSequencePart: 'aroh' | 'avaroh' = 'aroh';
  /** Total playback duration (used to compute practice time) */
  ragaPlaybackDurationMs = 0;
  /** Remaining practice time in seconds (countdown) */
  ragaPracticeCountdown = 0;
  /** All pitch samples collected during practice phase */
  ragaPracticeSamples: RoundPitchSample[] = [];
  /** Per-note analysis results for the result phase */
  ragaNoteResults: { note: IndianNote; hit: boolean; accuracy: number; count: number }[] = [];
  /** Overall accuracy for the raga practice result */
  ragaOverallAccuracy = 0;
  /** Notes the user sang that aren't in the raga */
  ragaWrongNotes: IndianNote[] = [];
  /** Natural-language summary for raga result */
  ragaResultSummary = '';
  ragaRoundScores: number[] = [];
  private ragaSessionStart = 0;
  private ragaPhaseTimer: ReturnType<typeof setTimeout> | null = null;
  private ragaCountdownTimer: ReturnType<typeof setInterval> | null = null;

  // ── Ear Training state ──
  earPhase: EarPhase = 'idle';
  earTargetNote: IndianNote = 'Sa';
  earGuessedNote: IndianNote | null = null;
  earIsCorrect = false;
  earScore  = 0;
  earStreak = 0;
  earBestStreak = 0;
  earRound  = 0;
  private earSessionStart = 0;
  private earPhaseTimer: ReturnType<typeof setTimeout> | null = null;

  liveNotes$!: Observable<IndianNote[]>;

  private destroy$    = new Subject<void>();
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private trainingEngine: TrainingEngineService,
    private tanpura: TanpuraPlayerService,
    private pitchDetection: PitchDetectionService,
    private api: ApiService,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService
  ) {
    this.liveNotes$ = this.trainingEngine.liveNotes$;
  }

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

    // Live pitch for raga mode
    this.pitchDetection.smoothPitch$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pitch: PitchResult) => {
        if (this.sessionActive && this.selectedMode === 'raga') {
          this.liveNote = pitch.indianNote;
          this.currentAccuracy = pitch.accuracy;
          this.cdr.markForCheck();
        }
      });
  }

  selectRaga(raga: RagaDefinition): void {
    this.selectedRaga = raga;
    this.analytics.logEvent('raga_selected', {
      raga_name:   raga.englishName,
      mela_number: raga.melaNumber ?? 0,
    });
    this.cdr.markForCheck();
  }

  clearRaga(): void {
    this.selectedRaga = null;
    this.cdr.markForCheck();
  }

  selectChakra(chakra: MelakartaChakra | null): void {
    this.selectedChakra = chakra;
    this.filterRagas();
  }

  filterRagas(): void {
    const q = this.ragaSearchQuery.toLowerCase().trim();
    let list: RagaDefinition[] = this.melakartaRagas;

    if (this.selectedChakra) {
      list = list.filter(r => r.chakra === this.selectedChakra);
    }

    if (q) {
      list = list.filter(r =>
        r.englishName.toLowerCase().includes(q) ||
        r.name.includes(q) ||
        r.thaat.toLowerCase().includes(q) ||
        (r.melaNumber != null && String(r.melaNumber) === q)
      );
    }

    this.filteredRagas = list;
    this.cdr.markForCheck();
  }

  isAllowed(note: IndianNote): boolean {
    if (!this.selectedRaga) return true;
    return this.selectedRaga.notes.includes(note);
  }

  // ── Session lifecycle ────────────────────────────────────

  async startSession(): Promise<void> {
    this.sessionActive = true;
    this.lastResult    = null;
    this.notePool      = [];
    this.analytics.logEvent('practice_started', { mode: this.selectedMode });
    this.cdr.markForCheck();

    if (this.selectedMode === 'shruti') {
      this.shrutiSessionStart = Date.now();
      this.shrutiRoundScores  = [];
      await this.startShrutiRound();
    } else if (this.selectedMode === 'raga' && this.selectedRaga) {
      // Build the note sequence: aroh (ascending) then avaroh (descending)
      this.ragaNoteSequence = [
        ...this.selectedRaga.aroh,
        ...this.selectedRaga.avaroh,
      ];
      this.ragaPlaybackIndex    = 0;
      this.ragaRoundScores      = [];
      this.ragaSessionStart     = Date.now();
      this.ragaSequencePart     = 'aroh';
      this.ragaPracticeSamples  = [];
      this.ragaNoteResults      = [];
      this.ragaOverallAccuracy  = 0;
      this.ragaWrongNotes       = [];
      this.ragaResultSummary    = '';
      await this.startRagaPlayback();
    } else if (this.selectedMode === 'free') {
      // Ear Training mode
      this.earSessionStart = Date.now();
      this.earScore       = 0;
      this.earStreak      = 0;
      this.earBestStreak  = 0;
      this.earRound       = 0;
      this.earPhase       = 'idle';
      this.earGuessedNote = null;
      this.earIsCorrect   = false;
      this.notePool       = [];
      await this.startEarRound();
    }
  }

  stopSession(): void {
    this.clearPhaseTimer();
    this.clearRagaPhaseTimer();

    if (this.selectedMode === 'shruti') {
      if (this.shrutiPhase === 'playing') {
        this.tanpura.stopAndSilence();
      } else if (this.shrutiPhase === 'listening') {
        this.pitchDetection.stop();
      }
      this.shrutiPhase = 'idle';

      // Persist shruti session (was previously missing — sessions were lost)
      const durationSeconds = Math.round((Date.now() - this.shrutiSessionStart) / 1000);
      const scores = this.shrutiRoundScores;
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      if (durationSeconds > 0 && scores.length > 0) {
        const tanpuraState = this.tanpura.state;
        this.api.createSession({
          duration:       durationSeconds,
          mode:           'shruti',
          key:            tanpuraState.key,
          score:          avgScore,
          avgAccuracy:    avgScore,
          stabilityScore: avgScore,
          noteAccuracies: {},
        }).then(() => {
          this.api.checkin(Math.ceil(durationSeconds / 60), avgScore).catch(() => {});
        }).catch(err => console.warn('[PracticePage] Failed to save shruti session:', err));
      }
    } else if (this.selectedMode === 'raga') {
      if (this.ragaPhase === 'playback') {
        this.tanpura.stopAndSilence();
      } else if (this.ragaPhase === 'practice') {
        this.pitchDetection.stop();
      }
      this.clearRagaCountdownTimer();

      // Persist raga session
      const durationSeconds = Math.round((Date.now() - this.ragaSessionStart) / 1000);
      const scores = this.ragaRoundScores;
      const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : 0;
      if (durationSeconds > 0 && scores.length > 0) {
        const tanpuraState = this.tanpura.state;
        this.api.createSession({
          duration:       durationSeconds,
          mode:           'raga',
          raagaId:        this.selectedRaga?.id,
          key:            tanpuraState.key,
          score:          avgScore,
          avgAccuracy:    avgScore,
          stabilityScore: avgScore,
          noteAccuracies: {},
        }).then(() => {
          this.api.checkin(Math.ceil(durationSeconds / 60), avgScore).catch(() => {});
        }).catch(err => console.warn('[PracticePage] Failed to save raga session:', err));
      }

      this.ragaPhase = 'idle';
    } else if (this.selectedMode === 'free') {
      // Ear Training cleanup
      this.clearEarPhaseTimer();
      if (this.earPhase === 'playing') {
        this.tanpura.stopAndSilence();
      }
      // Persist ear training session
      const durationSeconds = Math.round((Date.now() - this.earSessionStart) / 1000);
      if (durationSeconds > 0 && this.earRound > 0) {
        const avgScore = this.earRound > 0
          ? Math.round((this.earScore / this.earRound) * 100)
          : 0;
        const tanpuraState = this.tanpura.state;
        this.api.createSession({
          duration:       durationSeconds,
          mode:           'free',
          key:            tanpuraState.key,
          score:          avgScore,
          avgAccuracy:    avgScore,
          stabilityScore: avgScore,
          noteAccuracies: {},
        }).then(() => {
          this.api.checkin(Math.ceil(durationSeconds / 60), avgScore).catch(() => {});
        }).catch(err => console.warn('[PracticePage] Failed to save ear training session:', err));
      }

      this.earPhase = 'idle';
    }

    this.sessionActive   = false;
    this.analytics.logEvent('practice_stopped', {
      mode:             this.selectedMode,
      duration_seconds: this.selectedMode === 'shruti'
        ? Math.round((Date.now() - this.shrutiSessionStart) / 1000)
        : this.selectedMode === 'raga'
          ? Math.round((Date.now() - this.ragaSessionStart) / 1000)
          : Math.round((Date.now() - this.earSessionStart) / 1000),
    });
    this.liveNote        = null;
    this.currentAccuracy = null;
    this.cdr.markForCheck();
  }

  // ── Shruti round state machine ───────────────────────────

  private async startShrutiRound(): Promise<void> {
    if (!this.sessionActive) return;

    // Pick the next note from the shuffled pool
    this.currentTargetNote = this.drawNextNote();

    // Tune the tanpura so its Sa drone plays the target frequency.
    // ALL_SHRUTI_NOTES[i] is i semitones above C; setting key to
    // SEMITONE_TO_KEY[i] makes the tanpura drone ring on exactly that pitch.
    const semitone = ALL_SHRUTI_NOTES.indexOf(this.currentTargetNote);
    this.tanpura.setKey(SEMITONE_TO_KEY[semitone]);

    // ── Phase 1: PLAYING ──
    this.shrutiPhase     = 'playing';
    this.liveNote        = null;
    this.currentAccuracy = null;
    this.accuracySamples = [];
    this.roundSungNote   = null;
    this.roundFeedback   = '';
    this.cdr.markForCheck();

    await this.tanpura.play();

    this.phaseTimer = setTimeout(() => {
      if (!this.sessionActive) return;

      // ── Phase 2: READY (silence gap — oscillator tails die out) ──
      this.tanpura.stopAndSilence();
      this.shrutiPhase = 'ready';
      this.cdr.markForCheck();

      this.phaseTimer = setTimeout(async () => {
        if (!this.sessionActive) return;

        // ── Phase 3: LISTENING ──
        this.shrutiPhase = 'listening';
        this.cdr.markForCheck();

        await this.pitchDetection.start();
        const micOpenedAt = Date.now();

        const pitchSub = this.pitchDetection.smoothPitch$
          .pipe(takeUntil(this.destroy$))
          .subscribe((pitch: PitchResult) => {
            // Discard warmup samples (residual reverb tail)
            if (Date.now() - micOpenedAt < MIC_WARMUP_MS) return;
            this.liveNote        = pitch.indianNote;
            this.currentAccuracy = pitch.accuracy;
            this.accuracySamples.push({
              note:     pitch.indianNote,
              accuracy: pitch.accuracy,
              centsOff: pitch.centsOff
            });
            this.cdr.markForCheck();
          });

        this.phaseTimer = setTimeout(() => {
          pitchSub.unsubscribe();
          this.pitchDetection.stop();
          this.liveNote = null;

          // ── Phase 4: RESULT ──
          const samples = this.accuracySamples;

          this.roundAccuracy = samples.length
            ? Math.round(samples.reduce((a, b) => a + b.accuracy, 0) / samples.length)
            : 0;

          // Track round score for session-level persistence
          if (this.roundAccuracy > 0) this.shrutiRoundScores.push(this.roundAccuracy);

          // Most frequently detected note = what the user sang
          if (samples.length > 0) {
            const counts: Partial<Record<IndianNote, number>> = {};
            for (const s of samples) counts[s.note] = (counts[s.note] ?? 0) + 1;
            this.roundSungNote = (Object.entries(counts) as [IndianNote, number][])
              .sort((a, b) => b[1] - a[1])[0][0];
          } else {
            this.roundSungNote = null;
          }

          this.roundFeedback = buildFeedback(
            this.currentTargetNote,
            samples,
            this.roundAccuracy
          );

          this.shrutiPhase = 'result';
          this.analytics.logEvent('shruti_round_completed', {
            note:     this.currentTargetNote,
            accuracy: this.roundAccuracy,
            correct:  this.roundSungNote === this.currentTargetNote,
          });
          this.cdr.markForCheck();
        }, LISTEN_DURATION_MS);

      }, REVERB_GAP_MS);

    }, PLAY_DURATION_MS);
  }

  async nextShrutiRound(): Promise<void> {
    if (!this.sessionActive) return;
    await this.startShrutiRound();
  }

  // ── Raga practice state machine (whole-raga: playback → practice → result) ──

  /**
   * PLAYBACK PHASE: Plays the entire raga (aroh then avaroh) note by note.
   * Each note is tuned on the tanpura and played for `beatMs` ms, then the next
   * note starts immediately. User just listens (mic is off).
   */
  private async startRagaPlayback(): Promise<void> {
    if (!this.sessionActive || !this.selectedRaga) return;

    this.ragaPhase       = 'playback';
    this.ragaPlaybackIndex = 0;
    this.ragaSequencePart  = 'aroh';
    this.liveNote          = null;
    this.currentAccuracy   = null;
    this.cdr.markForCheck();

    const noteMs = ragaBeatMs(this.ragaBpm);
    this.ragaPlaybackDurationMs = noteMs * this.ragaNoteSequence.length;
    const arohLen = this.selectedRaga.aroh.length;

    // Play each note sequentially using chained timeouts
    const playNoteAt = (idx: number) => {
      if (!this.sessionActive || this.ragaPhase !== 'playback') return;
      if (idx >= this.ragaNoteSequence.length) {
        // Playback complete — stop tanpura, transition to practice
        this.tanpura.stopAndSilence();
        this.transitionToRagaPractice();
        return;
      }

      this.ragaPlaybackIndex = idx;
      this.ragaSequencePart  = idx < arohLen ? 'aroh' : 'avaroh';

      const note = this.ragaNoteSequence[idx];
      this.currentTargetNote = note;

      // Tune tanpura to this note's pitch
      const semitone = ALL_SHRUTI_NOTES.indexOf(note);
      this.tanpura.setKey(SEMITONE_TO_KEY[semitone]);
      this.tanpura.play();
      this.cdr.markForCheck();

      // After noteMs, move to next note
      this.ragaPhaseTimer = setTimeout(() => {
        this.tanpura.stopAndSilence();
        playNoteAt(idx + 1);
      }, noteMs);
    };

    playNoteAt(0);
  }

  /**
   * Transition gap between playback and practice.
   * Brief "get ready" pause, then opens the mic.
   */
  private transitionToRagaPractice(): void {
    if (!this.sessionActive) return;

    // Brief ready gap
    this.currentTargetNote = 'Sa'; // reset display
    this.cdr.markForCheck();

    this.ragaPhaseTimer = setTimeout(() => {
      if (!this.sessionActive) return;
      this.startRagaPractice();
    }, RAGA_READY_GAP_MS);
  }

  /**
   * PRACTICE PHASE: Mic opens for a long free-form listening period.
   * User sings the entire raga (aroh then avaroh) freely.
   * Duration = total playback time × multiplier, with a minimum floor.
   */
  private async startRagaPractice(): Promise<void> {
    if (!this.sessionActive || !this.selectedRaga) return;

    const practiceMs = Math.max(
      RAGA_MIN_PRACTICE_MS,
      Math.round(this.ragaPlaybackDurationMs * RAGA_PRACTICE_MULTIPLIER)
    );

    this.ragaPhase            = 'practice';
    this.ragaPracticeSamples  = [];
    this.liveNote             = null;
    this.currentAccuracy      = null;
    this.ragaPracticeCountdown = Math.ceil(practiceMs / 1000);
    this.cdr.markForCheck();

    await this.pitchDetection.start();
    const micOpenedAt = Date.now();

    // Collect pitch samples
    const pitchSub = this.pitchDetection.smoothPitch$
      .pipe(takeUntil(this.destroy$))
      .subscribe((pitch: PitchResult) => {
        if (Date.now() - micOpenedAt < MIC_WARMUP_MS) return;
        this.liveNote        = pitch.indianNote;
        this.currentAccuracy = pitch.accuracy;
        this.ragaPracticeSamples.push({
          note:     pitch.indianNote,
          accuracy: pitch.accuracy,
          centsOff: pitch.centsOff,
        });
        this.cdr.markForCheck();
      });

    // Countdown timer (updates every second)
    this.ragaCountdownTimer = setInterval(() => {
      this.ragaPracticeCountdown = Math.max(0, this.ragaPracticeCountdown - 1);
      this.cdr.markForCheck();
    }, 1000);

    // End practice after duration
    this.ragaPhaseTimer = setTimeout(() => {
      pitchSub.unsubscribe();
      this.pitchDetection.stop();
      this.clearRagaCountdownTimer();
      this.liveNote        = null;
      this.currentAccuracy = null;
      this.showRagaResult();
    }, practiceMs);
  }

  /**
   * RESULT PHASE: Analyze all collected samples against the raga's allowed notes.
   * Produce per-note accuracy breakdown, wrong notes, and overall accuracy.
   */
  private showRagaResult(): void {
    if (!this.selectedRaga) return;

    const samples = this.ragaPracticeSamples;
    const allowedNotes = this.selectedRaga.notes;
    // Unique notes in the raga (deduplicated from aroh + avaroh)
    const ragaUniqueNotes: IndianNote[] = [];
    const seen = new Set<IndianNote>();
    for (const n of [...this.selectedRaga.aroh, ...this.selectedRaga.avaroh]) {
      if (!seen.has(n)) { seen.add(n); ragaUniqueNotes.push(n); }
    }

    // Count per-note hits and accuracy
    const noteStats: Record<string, { total: number; accuracySum: number }> = {};
    for (const n of ragaUniqueNotes) noteStats[n] = { total: 0, accuracySum: 0 };

    const wrongNoteSet = new Set<IndianNote>();
    let matchingSamples = 0;

    for (const s of samples) {
      if (allowedNotes.includes(s.note)) {
        if (noteStats[s.note]) {
          noteStats[s.note].total++;
          noteStats[s.note].accuracySum += s.accuracy;
          matchingSamples++;
        }
      } else {
        wrongNoteSet.add(s.note);
      }
    }

    // Build per-note results
    this.ragaNoteResults = ragaUniqueNotes.map(note => {
      const stat = noteStats[note];
      const hit = stat.total > 0;
      const accuracy = hit ? Math.round(stat.accuracySum / stat.total) : 0;
      return { note, hit, accuracy, count: stat.total };
    });

    // Overall accuracy
    const hitNotes = this.ragaNoteResults.filter(r => r.hit);
    this.ragaOverallAccuracy = hitNotes.length > 0
      ? Math.round(hitNotes.reduce((sum, r) => sum + r.accuracy, 0) / hitNotes.length)
      : 0;

    // Track for session persistence
    if (this.ragaOverallAccuracy > 0) this.ragaRoundScores.push(this.ragaOverallAccuracy);

    // Wrong notes
    this.ragaWrongNotes = Array.from(wrongNoteSet);

    // Build summary
    this.ragaResultSummary = this.buildRagaSummary(samples.length, hitNotes.length, ragaUniqueNotes.length);

    this.ragaPhase = 'result';
    this.analytics.logEvent('raga_practice_completed', {
      raga_name:   this.selectedRaga.englishName,
      accuracy:    this.ragaOverallAccuracy,
      notes_hit:   hitNotes.length,
      notes_total: ragaUniqueNotes.length,
    });
    this.cdr.markForCheck();
  }

  /** Natural-language summary for the raga result phase. */
  private buildRagaSummary(totalSamples: number, hitCount: number, expectedCount: number): string {
    if (totalSamples === 0) {
      return "I didn't hear you sing. Try again — sing clearly into the mic, starting from Sa and going through the aroh then avaroh.";
    }

    const missedCount = expectedCount - hitCount;
    const pct = this.ragaOverallAccuracy;

    if (pct >= 90 && missedCount === 0) {
      return `Excellent! You nailed all ${expectedCount} notes with ${pct}% accuracy. Your raga recall is strong.`;
    }
    if (pct >= 75 && missedCount <= 1) {
      return `Great work! ${hitCount} of ${expectedCount} notes hit at ${pct}% accuracy.${missedCount === 1 ? ' One note was missed — listen for it next time.' : ''} Keep it up.`;
    }
    if (pct >= 60) {
      return `Good effort — ${hitCount} of ${expectedCount} notes at ${pct}% accuracy. Focus on the notes you missed and try to hold each one steadily.`;
    }
    if (hitCount > 0) {
      return `You hit ${hitCount} of ${expectedCount} notes at ${pct}% accuracy. Listen to the playback again carefully, then try to match each note more deliberately.`;
    }
    return `None of the raga notes were clearly detected. Listen to the playback, then sing slowly — start from Sa and take your time through each note.`;
  }

  /** Restart practice for the same raga (plays raga again then opens mic) */
  practiceRagaAgain(): void {
    if (!this.sessionActive || !this.selectedRaga) return;
    this.clearRagaPhaseTimer();
    this.clearRagaCountdownTimer();
    this.ragaPlaybackIndex   = 0;
    this.ragaSequencePart    = 'aroh';
    this.ragaPracticeSamples = [];
    this.ragaNoteResults     = [];
    this.ragaOverallAccuracy = 0;
    this.ragaWrongNotes      = [];
    this.ragaResultSummary   = '';
    this.startRagaPlayback();
  }

  onBpmChange(value: number): void {
    this.ragaBpm = +value;
    this.cdr.markForCheck();
  }

  // ── Ear Training state machine ──────────────────────────────

  /**
   * Start a new ear-training round:
   *  1. Pick a random note (via drawNextNote pool to avoid repeats)
   *  2. Tune tanpura to that note and play for ~2.5 s
   *  3. Transition to guess phase
   */
  private async startEarRound(): Promise<void> {
    if (!this.sessionActive) return;

    this.earRound++;
    this.earTargetNote  = this.drawNextNote();
    this.earGuessedNote = null;
    this.earIsCorrect   = false;
    this.earPhase       = 'playing';
    this.cdr.markForCheck();

    // Tune tanpura to the target note's pitch
    const semitone = ALL_SHRUTI_NOTES.indexOf(this.earTargetNote);
    this.tanpura.setKey(SEMITONE_TO_KEY[semitone]);
    await this.tanpura.play();

    // After PLAY_DURATION_MS, stop tanpura and transition to guess phase
    this.earPhaseTimer = setTimeout(() => {
      if (!this.sessionActive) return;
      this.tanpura.stopAndSilence();
      this.earPhase = 'guessing';
      this.cdr.markForCheck();
    }, PLAY_DURATION_MS);
  }

  /** User tapped a note in the guess grid */
  onEarGuess(note: IndianNote): void {
    if (this.earPhase !== 'guessing') return;

    this.earGuessedNote = note;
    this.earIsCorrect   = note === this.earTargetNote;

    if (this.earIsCorrect) {
      this.earScore++;
      this.earStreak++;
      if (this.earStreak > this.earBestStreak) {
        this.earBestStreak = this.earStreak;
      }
    } else {
      this.earStreak = 0;
    }

    this.earPhase = 'reveal';
    this.analytics.logEvent('ear_training_guess', {
      note:    note,
      correct: this.earIsCorrect,
      streak:  this.earStreak,
    });
    this.cdr.markForCheck();
  }

  /** Replay the current target note (re-tune tanpura & play again) */
  async replayEarNote(): Promise<void> {
    if (this.earPhase !== 'guessing') return;

    const semitone = ALL_SHRUTI_NOTES.indexOf(this.earTargetNote);
    this.tanpura.setKey(SEMITONE_TO_KEY[semitone]);
    await this.tanpura.play();

    // Stop after PLAY_DURATION_MS
    this.clearEarPhaseTimer();
    this.earPhaseTimer = setTimeout(() => {
      this.tanpura.stopAndSilence();
    }, PLAY_DURATION_MS);
  }

  /** Advance to the next round */
  nextEarRound(): void {
    if (!this.sessionActive) return;
    this.analytics.logEvent('ear_training_round_completed', {
      round:  this.earRound,
      score:  this.earScore,
      streak: this.earBestStreak,
    });
    this.startEarRound();
  }

  /**
   * Returns CSS modifier class for an ear-training note button based on
   * the current reveal state.
   */
  getEarBtnClass(note: IndianNote): string {
    if (this.earPhase !== 'reveal') return '';
    if (note === this.earTargetNote)  return 'ear-note-btn--correct';
    if (note === this.earGuessedNote) return 'ear-note-btn--wrong';
    return 'ear-note-btn--disabled';
  }

  private clearEarPhaseTimer(): void {
    if (this.earPhaseTimer !== null) {
      clearTimeout(this.earPhaseTimer);
      this.earPhaseTimer = null;
    }
  }

  // ── Note pool ────────────────────────────────────────────

  /**
   * Draws the next note from a shuffled pool that cycles through all 12 notes.
   * Refills when empty, excluding the last-played note to prevent back-to-back repeats.
   */
  private drawNextNote(): IndianNote {
    if (this.notePool.length === 0) {
      const candidates = ALL_SHRUTI_NOTES.filter(n => n !== this.currentTargetNote);
      this.notePool = this.shuffle(candidates);
    }
    return this.notePool.pop()!;
  }

  private shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── Helpers ──────────────────────────────────────────────

  private clearPhaseTimer(): void {
    if (this.phaseTimer !== null) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private clearRagaPhaseTimer(): void {
    if (this.ragaPhaseTimer !== null) {
      clearTimeout(this.ragaPhaseTimer);
      this.ragaPhaseTimer = null;
    }
  }

  private clearRagaCountdownTimer(): void {
    if (this.ragaCountdownTimer !== null) {
      clearInterval(this.ragaCountdownTimer);
      this.ragaCountdownTimer = null;
    }
  }

  private persistResult(result: TrainingSessionResult): void {
    if (result.duration <= 0) return;

    const noteAccuracies: Record<string, number> = {};
    for (const [note, data] of Object.entries(result.noteAccuracies)) {
      noteAccuracies[note] = Math.round((data as { avgAccuracy: number }).avgAccuracy);
    }
    const tanpuraState = this.tanpura.state;
    this.api.createSession({
      duration:       Math.round(result.duration),
      mode:           result.mode,
      raagaId:        result.raga?.id,
      key:            tanpuraState.key,
      score:          Math.round(result.overallAccuracy),
      avgAccuracy:    Math.round(result.overallAccuracy),
      stabilityScore: Math.round(result.pitchStability),
      noteAccuracies,
      aiSummary:      result.recommendations[0],
    }).then(() => {
      this.api.checkin(Math.ceil(result.duration / 60), Math.round(result.overallAccuracy)).catch(() => {});
    }).catch(err => console.warn('[PracticePage] Failed to save session:', err));
  }

  ngOnDestroy(): void {
    if (this.sessionActive) this.stopSession();
    this.clearPhaseTimer();
    this.clearRagaPhaseTimer();
    this.clearRagaCountdownTimer();
    this.clearEarPhaseTimer();
    this.destroy$.next();
    this.destroy$.complete();
  }
}
