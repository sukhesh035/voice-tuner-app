import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { PitchDetectionService, PitchResult, IndianNote } from '@voice-tuner/pitch-detection';
import { RagaDefinition, NOTE_SEMITONES } from './raga-data';

// ── Training Session Types ─────────────────────────────────

export type TrainingMode = 'shruti' | 'raga' | 'free';

export interface NoteEvent {
  note:      IndianNote;
  frequency: number;
  startTime: number;
  duration:  number;
  accuracy:  number;
  centsOff:  number;
  isAllowed: boolean;   // for raga mode
}

export interface TrainingSessionResult {
  mode:              TrainingMode;
  raga?:             RagaDefinition;
  duration:          number;        // seconds
  totalNotes:        number;
  noteAccuracies:    Record<IndianNote, { count: number; avgAccuracy: number; avgCents: number }>;
  pitchStability:    number;        // 0–100
  overallAccuracy:   number;        // 0–100
  disallowedNotes:   IndianNote[];  // notes sung outside raga
  recommendations:   string[];
  practiceHistory:   NoteEvent[];
  timestamp:         number;
}

export interface AICoachFeedback {
  score:           number;           // 0–100
  strengths:       string[];
  improvements:    string[];
  topRecommendation: string;
  weeklyTrend:     'improving' | 'stable' | 'declining';
  practicePlan:    PracticePlanItem[];
}

export interface PracticePlanItem {
  note:       IndianNote;
  duration:   number;       // minutes
  exercise:   string;
  priority:   'high' | 'medium' | 'low';
}

/**
 * TrainingEngineService
 * Orchestrates practice sessions, tracks note accuracy, and generates
 * AI coaching feedback based on pitch detection data.
 */
@Injectable({ providedIn: 'root' })
export class TrainingEngineService {
  private readonly pitchDetection = inject(PitchDetectionService);

  private sessionActive     = false;
  private sessionStart      = 0;
  private currentMode: TrainingMode = 'free';
  private currentRaga: RagaDefinition | null = null;
  private noteEvents: NoteEvent[] = [];
  private currentNoteStart  = 0;
  private currentNote: IndianNote | null = null;
  private pitchSub: Subscription | null = null;
  private allSessionResults: TrainingSessionResult[] = [];

  private sessionStateSubject = new BehaviorSubject<'idle' | 'active' | 'paused'>('idle');
  private liveNotesSubject    = new BehaviorSubject<IndianNote[]>([]);

  get sessionState$(): Observable<'idle' | 'active' | 'paused'> {
    return this.sessionStateSubject.asObservable();
  }

  get liveNotes$(): Observable<IndianNote[]> {
    return this.liveNotesSubject.asObservable();
  }

  // ── Session Lifecycle ──────────────────────────────────

  async startSession(mode: TrainingMode, raga?: RagaDefinition): Promise<void> {
    this.currentMode  = mode;
    this.currentRaga  = raga ?? null;
    this.noteEvents   = [];
    this.sessionStart = Date.now();
    this.sessionActive = true;
    this.sessionStateSubject.next('active');

    await this.pitchDetection.start();
    this.subscribeToPitch();
  }

  pauseSession(): void {
    this.sessionStateSubject.next('paused');
    this.pitchSub?.unsubscribe();
  }

  resumeSession(): void {
    this.sessionStateSubject.next('active');
    this.subscribeToPitch();
  }

  endSession(): TrainingSessionResult {
    this.sessionActive = false;
    this.pitchSub?.unsubscribe();
    this.pitchDetection.stop();
    this.sessionStateSubject.next('idle');

    const result = this.buildSessionResult();
    this.allSessionResults.push(result);
    return result;
  }

  // ── Raga Compliance ───────────────────────────────────

  isNoteAllowed(note: IndianNote): boolean {
    if (!this.currentRaga) return true;
    return this.currentRaga.notes.includes(note);
  }

  getDisallowedNotes(): IndianNote[] {
    if (!this.currentRaga) return [];
    const sung = [...new Set(this.noteEvents.map(e => e.note))];
    return sung.filter(n => !this.currentRaga!.notes.includes(n));
  }

  // ── AI Coach ──────────────────────────────────────────

  generateAIFeedback(result: TrainingSessionResult): AICoachFeedback {
    const { noteAccuracies, pitchStability, overallAccuracy } = result;

    const strengths:     string[] = [];
    const improvements:  string[] = [];
    const practicePlan:  PracticePlanItem[] = [];

    // Analyse per-note accuracy
    for (const [note, data] of Object.entries(noteAccuracies) as [IndianNote, typeof noteAccuracies[IndianNote]][]) {
      if (data.count < 3) continue;

      if (data.avgAccuracy >= 88) {
        strengths.push(`${note} is very stable (${data.avgAccuracy.toFixed(0)}% accuracy)`);
      } else if (data.avgAccuracy < 70) {
        const direction = data.avgCents > 0 ? 'sharp' : 'flat';
        improvements.push(`${note} needs work — you're singing ${Math.abs(data.avgCents).toFixed(0)} cents ${direction}`);
        practicePlan.push({
          note,
          duration: 5,
          exercise: `Sing ${note} slowly with tanpura drone. Focus on landing exactly on pitch.`,
          priority: data.avgAccuracy < 55 ? 'high' : 'medium'
        });
      }
    }

    if (pitchStability < 60) {
      improvements.push('Pitch stability needs improvement — try slower tempos with focused breath support');
    } else if (pitchStability >= 85) {
      strengths.push(`Excellent pitch stability (${pitchStability.toFixed(0)}/100)`);
    }

    const score = Math.round(overallAccuracy * 0.6 + pitchStability * 0.4);

    const topNote = Object
      .entries(noteAccuracies)
      .filter(([, d]) => d.count >= 3)
      .sort(([, a], [, b]) => a.avgAccuracy - b.avgAccuracy)[0] as [IndianNote, typeof noteAccuracies[IndianNote]] | undefined;

    const topRecommendation = topNote && topNote[1].avgAccuracy < 75
      ? `Practice ${topNote[0]} slowly with tanpura for ${topNote[1].avgAccuracy < 55 ? 10 : 5} minutes.`
      : 'Continue daily riyaz. Focus on maintaining pitch across octave transitions.';

    // Determine weekly trend from historical data
    const recent = this.allSessionResults.slice(-7);
    let weeklyTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (recent.length >= 3) {
      const avg1 = recent.slice(0, Math.floor(recent.length / 2))
        .reduce((s, r) => s + r.overallAccuracy, 0) / Math.floor(recent.length / 2);
      const avg2 = recent.slice(Math.floor(recent.length / 2))
        .reduce((s, r) => s + r.overallAccuracy, 0) / (recent.length - Math.floor(recent.length / 2));
      if (avg2 - avg1 > 3) weeklyTrend = 'improving';
      else if (avg1 - avg2 > 3) weeklyTrend = 'declining';
    }

    return {
      score,
      strengths:   strengths.length ? strengths : ['Keep practicing regularly to build muscle memory'],
      improvements: improvements.length ? improvements : ['Great work! Focus on consistency'],
      topRecommendation,
      weeklyTrend,
      practicePlan: practicePlan.sort((a, b) =>
        ({ high: 0, medium: 1, low: 2 }[a.priority]) - ({ high: 0, medium: 1, low: 2 }[b.priority])
      )
    };
  }

  // ── Private: Pitch Processing ──────────────────────────

  private subscribeToPitch(): void {
    this.pitchSub = this.pitchDetection.smoothPitch$
      .pipe(filter(() => this.sessionActive))
      .subscribe(pitch => this.onPitchDetected(pitch));
  }

  private onPitchDetected(pitch: PitchResult): void {
    const now = Date.now();

    if (this.currentNote !== pitch.indianNote) {
      // Commit previous note event
      if (this.currentNote !== null && now - this.currentNoteStart > 100) {
        const existing = this.noteEvents.slice(-1)[0];
        if (existing && existing.note === this.currentNote) {
          existing.duration = now - this.currentNoteStart;
        }
      }

      // Start new note event
      this.currentNote      = pitch.indianNote;
      this.currentNoteStart = now;
      this.noteEvents.push({
        note:      pitch.indianNote,
        frequency: pitch.frequency,
        startTime: now,
        duration:  0,
        accuracy:  pitch.accuracy,
        centsOff:  pitch.centsOff,
        isAllowed: this.isNoteAllowed(pitch.indianNote)
      });
    } else {
      // Update ongoing note
      const last = this.noteEvents[this.noteEvents.length - 1];
      if (last) {
        last.accuracy  = (last.accuracy * 0.9) + (pitch.accuracy * 0.1); // EMA
        last.duration  = now - this.currentNoteStart;
      }
    }

    // Emit live note set (recently heard notes)
    const recentNotes = [...new Set(
      this.noteEvents.slice(-20).map(e => e.note)
    )];
    this.liveNotesSubject.next(recentNotes);
  }

  private buildSessionResult(): TrainingSessionResult {
    const duration = (Date.now() - this.sessionStart) / 1000;
    const validEvents = this.noteEvents.filter(e => e.duration > 150);

    const noteAccuracies: TrainingSessionResult['noteAccuracies'] = {} as any;
    for (const event of validEvents) {
      const n = event.note;
      if (!noteAccuracies[n]) {
        noteAccuracies[n] = { count: 0, avgAccuracy: 0, avgCents: 0 };
      }
      const entry = noteAccuracies[n];
      entry.count++;
      entry.avgAccuracy += event.accuracy;
      entry.avgCents    += event.centsOff;
    }
    for (const entry of Object.values(noteAccuracies)) {
      entry.avgAccuracy /= entry.count;
      entry.avgCents    /= entry.count;
    }

    const allAccuracies = validEvents.map(e => e.accuracy);
    const overallAccuracy = allAccuracies.length
      ? allAccuracies.reduce((a, b) => a + b, 0) / allAccuracies.length
      : 0;

    const allCents    = validEvents.map(e => e.centsOff);
    const meanCents   = allCents.length
      ? allCents.reduce((a, b) => a + b, 0) / allCents.length
      : 0;
    const variance    = allCents.reduce((s, c) => s + Math.pow(c - meanCents, 2), 0) / (allCents.length || 1);
    const pitchStability = Math.max(0, 100 - Math.sqrt(variance) * 2);

    const disallowedNotes = this.getDisallowedNotes();
    const tempResult: TrainingSessionResult = {
      mode: this.currentMode,
      raga: this.currentRaga ?? undefined,
      duration,
      totalNotes:    validEvents.length,
      noteAccuracies,
      pitchStability,
      overallAccuracy,
      disallowedNotes,
      recommendations: [],
      practiceHistory: this.noteEvents,
      timestamp: Date.now()
    };

    const feedback = this.generateAIFeedback(tempResult);
    tempResult.recommendations = [
      feedback.topRecommendation,
      ...feedback.improvements.slice(0, 2)
    ];

    return tempResult;
  }
}
