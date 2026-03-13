import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent
} from '@ionic/angular/standalone';

interface WeeklyProgress { day: string; accuracy: number; minutes: number; }

@Component({
  selector: 'app-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonContent],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Progress</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="progress-page">

        <!-- Overall Score -->
        <div class="overall-card sruti-card sruti-card--gradient">
          <div class="overall-score">
            <div class="score-ring">
              <svg viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"/>
                <circle cx="60" cy="60" r="50" fill="none"
                  stroke="url(#scoreGrad)"
                  stroke-width="10"
                  stroke-linecap="round"
                  stroke-dasharray="209 314"
                  stroke-dashoffset="-78"
                  transform="rotate(-90 60 60)"
                />
                <defs>
                  <linearGradient id="scoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="#7C4DFF"/>
                    <stop offset="100%" stop-color="#00E5C2"/>
                  </linearGradient>
                </defs>
              </svg>
              <div class="score-value">83</div>
            </div>
            <div class="overall-info">
              <div class="overall-title">Overall Score</div>
              <div class="overall-sub">Based on last 30 days</div>
              <div class="sruti-streak-badge" style="margin-top: 8px">
                <span class="streak-icon">🔥</span> 7 Day Streak
              </div>
            </div>
          </div>
        </div>

        <!-- Weekly stats -->
        <div class="section">
          <div class="section-label">This Week</div>
          <div class="week-cards">
            <div *ngFor="let d of weeklyData" class="week-day-card sruti-card">
              <div class="week-day-name">{{ d.day }}</div>
              <div class="sruti-progress-bar" style="margin: 8px 0">
                <div class="progress-fill" [style.width]="d.accuracy + '%'"></div>
              </div>
              <div class="week-day-acc">{{ d.accuracy }}%</div>
            </div>
          </div>
        </div>

        <!-- Note Accuracy Grid -->
        <div class="section">
          <div class="section-label">Note Accuracy</div>
          <div class="note-accuracy-grid">
            <div *ngFor="let note of noteAccuracy" class="note-acc-item sruti-card">
              <div class="note-acc-name">{{ note.note }}</div>
              <div class="note-acc-bar">
                <div class="note-acc-fill" [style.width]="note.accuracy + '%'"
                  [style.background]="note.color"></div>
              </div>
              <div class="note-acc-pct">{{ note.accuracy }}%</div>
            </div>
          </div>
        </div>

        <!-- AI Coach Summary -->
        <div class="section">
          <div class="section-label">AI Coach Summary</div>
          <div class="sruti-card coach-card">
            <div class="coach-icon">🤖</div>
            <div class="coach-content">
              <div class="coach-title">Weekly Analysis</div>
              <p class="coach-text">
                Your Sa and Pa are very stable. Focus on Ga — you're consistently
                singing 18 cents sharp. Practice Ga with tanpura drone for 5 minutes daily.
              </p>
              <div class="coach-tags">
                <span class="coach-tag good">Sa ✓</span>
                <span class="coach-tag good">Pa ✓</span>
                <span class="coach-tag warn">Ga ↑18¢</span>
                <span class="coach-tag warn">Ni ↑12¢</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Practice History -->
        <div class="section">
          <div class="section-label">Recent Sessions</div>
          <div *ngFor="let session of recentSessions" class="session-item sruti-card">
            <div class="session-info">
              <div class="session-raga">{{ session.raga }}</div>
              <div class="session-meta">{{ session.date }} · {{ session.duration }}min</div>
            </div>
            <div class="session-score" [style.color]="scoreColor(session.accuracy)">
              {{ session.accuracy }}%
            </div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .progress-page {
      padding: 16px;
      padding-bottom: calc(80px + env(safe-area-inset-bottom));
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .section-label {
      font-size: 12px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.08em; color: var(--sruti-text-secondary); margin-bottom: 12px;
    }
    .section { display: flex; flex-direction: column; gap: 0; }
    .overall-card { padding: 20px !important; }
    .overall-score { display: flex; align-items: center; gap: 20px; }
    .score-ring { position: relative; width: 100px; height: 100px; flex-shrink: 0; }
    .score-ring svg { width: 100%; height: 100%; }
    .score-value {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      font-size: 28px; font-weight: 800; color: var(--sruti-text-primary);
    }
    .overall-title { font-size: 18px; font-weight: 700; }
    .overall-sub { font-size: 13px; color: var(--sruti-text-secondary); }
    .week-cards { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .week-day-card { padding: 8px 4px !important; text-align: center; }
    .week-day-name { font-size: 10px; color: var(--sruti-text-secondary); font-weight: 600; }
    .week-day-acc { font-size: 11px; font-weight: 700; color: var(--sruti-primary); }
    .note-accuracy-grid { display: flex; flex-direction: column; gap: 8px; }
    .note-acc-item { padding: 10px 14px !important; display: flex; align-items: center; gap: 12px; }
    .note-acc-name { width: 40px; font-size: 14px; font-weight: 700; flex-shrink: 0; }
    .note-acc-bar { flex: 1; height: 6px; background: var(--sruti-border); border-radius: 99px; overflow: hidden; }
    .note-acc-fill { height: 100%; border-radius: 99px; }
    .note-acc-pct { width: 36px; text-align: right; font-size: 13px; font-weight: 600; font-family: var(--sruti-font-mono); }
    .coach-card { display: flex; gap: 16px; }
    .coach-icon { font-size: 28px; }
    .coach-title { font-size: 16px; font-weight: 700; margin-bottom: 6px; }
    .coach-text { font-size: 14px; color: var(--sruti-text-secondary); line-height: 1.5; margin: 0 0 10px; }
    .coach-tags { display: flex; gap: 6px; flex-wrap: wrap; }
    .coach-tag { font-size: 12px; font-weight: 600; padding: 2px 10px; border-radius: 99px; }
    .coach-tag.good { background: rgba(0,230,118,0.12); color: #00e676; }
    .coach-tag.warn { background: rgba(255,179,0,0.12);  color: #ffb300; }
    .session-item { display: flex; align-items: center; padding: 14px 16px !important; margin-bottom: 8px; }
    .session-info { flex: 1; }
    .session-raga { font-size: 15px; font-weight: 600; }
    .session-meta { font-size: 12px; color: var(--sruti-text-secondary); }
    .session-score { font-size: 18px; font-weight: 800; font-family: var(--sruti-font-mono); }
  `]
})
export class ProgressPage {
  readonly weeklyData: WeeklyProgress[] = [
    { day: 'M', accuracy: 82, minutes: 12 },
    { day: 'T', accuracy: 75, minutes: 8  },
    { day: 'W', accuracy: 90, minutes: 20 },
    { day: 'T', accuracy: 68, minutes: 5  },
    { day: 'F', accuracy: 85, minutes: 15 },
    { day: 'S', accuracy: 78, minutes: 10 },
    { day: 'S', accuracy: 0,  minutes: 0  }
  ];

  readonly noteAccuracy = [
    { note: 'Sa',  accuracy: 91, color: '#FF6B6B' },
    { note: 'Re',  accuracy: 78, color: '#FF8E53' },
    { note: 'Ga',  accuracy: 64, color: '#FFC300' },
    { note: 'Ma',  accuracy: 83, color: '#4CAF50' },
    { note: 'Pa',  accuracy: 88, color: '#2196F3' },
    { note: 'Dha', accuracy: 72, color: '#9C27B0' },
    { note: 'Ni',  accuracy: 70, color: '#E91E63' }
  ];

  readonly recentSessions = [
    { raga: 'Yaman', date: 'Today', duration: 12, accuracy: 84 },
    { raga: 'Bhairav', date: 'Yesterday', duration: 18, accuracy: 71 },
    { raga: 'Free Practice', date: '2 days ago', duration: 8, accuracy: 79 }
  ];

  scoreColor(acc: number): string {
    if (acc >= 85) return 'var(--sruti-pitch-perfect)';
    if (acc >= 70) return 'var(--sruti-pitch-close)';
    return 'var(--sruti-pitch-off)';
  }
}
