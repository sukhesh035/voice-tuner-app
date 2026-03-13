import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSegment,
  IonSegmentButton, IonLabel, IonInput, IonButton
} from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';

interface ClassroomSession {
  sessionCode: string;
  raga:        string;
  saKey:       string;
  tempo:       number;
  duration:    number;
}

interface StudentResult {
  studentName: string;
  accuracy:    number;
  duration:    number;
  streakDays:  number;
  completed:   boolean;
}

@Component({
  selector: 'app-guru',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel, IonInput, IonButton
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Guru Mode</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="guru-page">

        <ion-segment [(ngModel)]="tab">
          <ion-segment-button value="create">
            <ion-label>Create Session</ion-label>
          </ion-segment-button>
          <ion-segment-button value="dashboard">
            <ion-label>Dashboard</ion-label>
          </ion-segment-button>
        </ion-segment>

        <!-- Create Session -->
        <div *ngIf="tab === 'create'" class="create-section animate-fade-in">
          <div class="sruti-card create-form">
            <div class="form-title">Create Practice Session</div>

            <div class="form-group">
              <label class="form-label">Raga</label>
              <select class="form-select" [(ngModel)]="newSession.raga">
                <option *ngFor="let r of ragas" [value]="r">{{ r }}</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Sa (Key)</label>
                <select class="form-select" [(ngModel)]="newSession.saKey">
                  <option *ngFor="let k of keys" [value]="k">{{ k }}</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Tempo (BPM)</label>
                <input class="form-input" type="number" [(ngModel)]="newSession.tempo" min="40" max="120" />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Practice Duration (min)</label>
              <input class="form-input" type="number" [(ngModel)]="newSession.duration" min="5" max="60" />
            </div>

            <button class="sruti-btn sruti-btn--primary create-btn" (click)="createSession()">
              {{ isCreating ? 'Creating...' : 'Generate Session Code' }}
            </button>
          </div>

          <!-- Session Code Display -->
          <div *ngIf="activeSession" class="session-code-card sruti-card animate-bounce-in">
            <div class="code-label">Share this code with students</div>
            <div class="code-display">{{ activeSession.sessionCode }}</div>
            <div class="code-details">
              <span>{{ activeSession.raga }}</span>
              <span>Sa: {{ activeSession.saKey }}</span>
              <span>{{ activeSession.tempo }} BPM</span>
              <span>{{ activeSession.duration }} min</span>
            </div>
          </div>
        </div>

        <!-- Dashboard -->
        <div *ngIf="tab === 'dashboard'" class="dashboard-section animate-fade-in">
          <div class="dash-summary">
            <div class="sruti-stat-card">
              <div class="stat-value">{{ studentResults.length }}</div>
              <div class="stat-label">Students</div>
            </div>
            <div class="sruti-stat-card">
              <div class="stat-value">{{ avgAccuracy | number:'1.0-0' }}%</div>
              <div class="stat-label">Avg Accuracy</div>
            </div>
            <div class="sruti-stat-card">
              <div class="stat-value">{{ completedCount }}</div>
              <div class="stat-label">Completed</div>
            </div>
          </div>

          <div class="students-list">
            <div *ngFor="let s of studentResults" class="student-row sruti-card">
              <div class="student-avatar">{{ s.studentName[0] }}</div>
              <div class="student-info">
                <div class="student-name">{{ s.studentName }}</div>
                <div class="student-meta">
                  {{ s.duration }}min · Streak {{ s.streakDays }}🔥
                </div>
              </div>
              <div class="student-accuracy" [style.color]="scoreColor(s.accuracy)">
                {{ s.accuracy }}%
              </div>
              <div class="student-status" [class.done]="s.completed">
                {{ s.completed ? '✓' : '...' }}
              </div>
            </div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .guru-page {
      padding: 16px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    ion-segment { margin-bottom: 4px; }
    .create-form { display: flex; flex-direction: column; gap: 16px; }
    .form-title { font-size: 18px; font-weight: 700; }
    .form-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--sruti-text-secondary); display: block; margin-bottom: 6px; }
    .form-select, .form-input {
      width: 100%; padding: 10px 14px; background: var(--sruti-bg-input);
      border: 1px solid var(--sruti-border); border-radius: 10px;
      color: var(--sruti-text-primary); font-size: 15px; outline: none;
    }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .form-group { display: flex; flex-direction: column; }
    .create-btn { width: 100%; padding: 14px !important; font-size: 16px !important; }
    .session-code-card { text-align: center; display: flex; flex-direction: column; gap: 12px; }
    .code-label { font-size: 13px; color: var(--sruti-text-secondary); }
    .code-display { font-size: 48px; font-weight: 900; font-family: var(--sruti-font-mono); letter-spacing: 0.15em; background: var(--sruti-gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
    .code-details { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .code-details span { font-size: 13px; background: var(--sruti-bg-input); border-radius: 8px; padding: 4px 10px; color: var(--sruti-text-secondary); }
    .dash-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .students-list { display: flex; flex-direction: column; gap: 8px; }
    .student-row { display: flex; align-items: center; gap: 12px; padding: 12px 16px !important; }
    .student-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--sruti-gradient-primary); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: white; flex-shrink: 0; }
    .student-info { flex: 1; }
    .student-name { font-size: 15px; font-weight: 600; }
    .student-meta { font-size: 12px; color: var(--sruti-text-secondary); }
    .student-accuracy { font-size: 18px; font-weight: 800; font-family: var(--sruti-font-mono); }
    .student-status { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: var(--sruti-border); &.done { background: rgba(0,230,118,0.2); color: #00e676; } }
  `]
})
export class GuruPage implements OnInit {
  tab = 'create';
  isCreating = false;
  activeSession: ClassroomSession | null = null;

  readonly ragas = ['Yaman', 'Bhairav', 'Kalyani', 'Hamsadhwani', 'Todi', 'Bihag', 'Bhimpalasi'];
  readonly keys  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  newSession = { raga: 'Yaman', saKey: 'D', tempo: 60, duration: 10 };

  studentResults: StudentResult[] = [];

  get avgAccuracy(): number {
    if (!this.studentResults.length) return 0;
    return this.studentResults.reduce((s, r) => s + r.accuracy, 0) / this.studentResults.length;
  }
  get completedCount(): number { return this.studentResults.filter(r => r.completed).length; }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    // Mock data for demo
    this.studentResults = [
      { studentName: 'Riya', accuracy: 88, duration: 10, streakDays: 5, completed: true },
      { studentName: 'Arjun', accuracy: 72, duration: 8, streakDays: 3, completed: true },
      { studentName: 'Meera', accuracy: 91, duration: 10, streakDays: 12, completed: true },
      { studentName: 'Dev', accuracy: 65, duration: 6, streakDays: 1, completed: false }
    ];
  }

  async createSession(): Promise<void> {
    this.isCreating = true;
    this.cdr.markForCheck();
    try {
      // Call backend API to create session
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.activeSession = { ...this.newSession, sessionCode: code };
    } finally {
      this.isCreating = false;
      this.cdr.markForCheck();
    }
  }

  scoreColor(acc: number): string {
    if (acc >= 85) return 'var(--sruti-pitch-perfect)';
    if (acc >= 70) return 'var(--sruti-pitch-close)';
    return 'var(--sruti-pitch-off)';
  }
}
