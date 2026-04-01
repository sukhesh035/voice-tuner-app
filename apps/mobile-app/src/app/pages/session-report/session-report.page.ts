import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnInit, inject,
} from '@angular/core';
import { DecimalPipe, TitleCasePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonChip, IonSpinner, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sparklesOutline, refreshOutline, barChartOutline } from 'ionicons/icons';
import { RAGAS, RagaDefinition } from '@voice-tuner/training-engine';
import { formatDuration } from '@voice-tuner/shared-utils';
import { AnalyticsService } from '../../core/services/analytics.service';

export interface SessionReportData {
  sessionId:      string;
  mode:           string;
  raagaId?:       string;
  key:            string;
  duration:       number;
  score:          number;
  avgAccuracy:    number;
  stabilityScore: number;
  noteAccuracies: Record<string, number>;
  aiSummary?:     string;
  createdAt:      string;
}

type Grade = { label: string; color: string };

function getGrade(score: number): Grade {
  if (score >= 90) return { label: 'S',  color: '#FFD700' };
  if (score >= 75) return { label: 'A+', color: '#7C4DFF' };
  if (score >= 60) return { label: 'A',  color: '#00E5C2' };
  if (score >= 45) return { label: 'B',  color: '#64B5F6' };
  if (score >= 30) return { label: 'C',  color: '#FFC107' };
  return             { label: 'D',  color: '#F44336' };
}

@Component({
  selector: 'app-session-report',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DecimalPipe, TitleCasePipe, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonChip, IonSpinner, IonBackButton, IonButtons],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tabs/progress"></ion-back-button>
        </ion-buttons>
        <ion-title>Session Report</ion-title>
      </ion-toolbar>
    </ion-header>

    @if (report) {
    <ion-content class="ion-padding">

      <!-- ─── Grade Hero ───────────────────────────────────────────────── -->
      <div class="grade-hero swara-card" style="text-align:center; margin-bottom:1.5rem; padding:2rem;">
        <div
          class="grade-badge"
          [style.color]="grade.color"
          [style.border-color]="grade.color"
        >{{ grade.label }}</div>
        <div style="font-size:2.5rem; font-weight:800; margin:0.5rem 0;">
          {{ report.score }}<span style="font-size:1rem; color:var(--swara-text-muted);">/100</span>
        </div>
        <div style="color:var(--swara-text-muted); font-size:0.9rem;">
          {{ report.mode | titlecase }} &bull; {{ report.key }} &bull; {{ formattedDuration }}
        </div>
        @if (raga) {
        <div style="margin-top:0.5rem;">
          <ion-chip [style.background]="raga.color + '33'" [style.color]="raga.color">
            {{ raga.name }}
          </ion-chip>
        </div>
        }
      </div>

      <!-- ─── Key Metrics ──────────────────────────────────────────────── -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
        <div class="swara-stat-card" style="text-align:center;">
          <div class="metric-value" style="color:var(--swara-secondary);">
            {{ report.avgAccuracy | number:'1.0-0' }}<span style="font-size:1rem;">%</span>
          </div>
          <div class="metric-label">Avg Accuracy</div>
        </div>
        <div class="swara-stat-card" style="text-align:center;">
          <div class="metric-value" style="color:var(--swara-accent);">
            {{ (report.stabilityScore * 100) | number:'1.0-0' }}<span style="font-size:1rem;">%</span>
          </div>
          <div class="metric-label">Pitch Stability</div>
        </div>
      </div>

      <!-- ─── Note Accuracy Bars ───────────────────────────────────────── -->
      <div class="swara-card" style="margin-bottom:1.5rem;">
        <h4 style="margin:0 0 1rem;">Note Accuracy</h4>
        @for (note of noteList; track note.name) {
        <div style="margin-bottom:0.75rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
            <span style="font-weight:600;">{{ note.name }}</span>
            <span style="color:var(--swara-text-muted);">{{ note.value | number:'1.0-0' }}%</span>
          </div>
          <div class="swara-progress-bar">
            <div
              class="swara-progress-fill"
              [style.width.%]="note.value"
              [style.background]="noteColor(note.value)"
            ></div>
          </div>
        </div>
        }
        @if (noteList.length === 0) {
        <div style="color:var(--swara-text-muted); text-align:center;">
          No note data recorded
        </div>
        }
      </div>

      <!-- ─── AI Summary ───────────────────────────────────────────────── -->
      @if (report.aiSummary) {
      <div class="swara-card" style="margin-bottom:1.5rem;">
        <h4 style="margin:0 0 0.75rem;">
          <ion-icon name="sparkles-outline" style="vertical-align:middle; margin-right:0.5rem;"></ion-icon>
          AI Coach Feedback
        </h4>
        <p style="color:var(--swara-text-secondary); line-height:1.6;">{{ report.aiSummary }}</p>
      </div>
      }

      <!-- ─── Actions ──────────────────────────────────────────────────── -->
      <div style="display:flex; gap:1rem; margin-bottom:2rem;">
        <ion-button expand="block" fill="outline" (click)="practiceAgain()" style="flex:1;">
          <ion-icon name="refresh-outline" slot="start"></ion-icon>
          Practice Again
        </ion-button>
        <ion-button expand="block" (click)="goToProgress()" style="flex:1;">
          <ion-icon name="bar-chart-outline" slot="start"></ion-icon>
          Progress
        </ion-button>
      </div>

    </ion-content>
    }

    @if (!report) {
    <ion-content class="ion-padding">
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:60vh; gap:1rem; text-align:center;">
        <div style="font-size:3rem;">🎵</div>
        <div style="font-size:1.1rem; font-weight:700;">No session data</div>
        <div style="color:var(--swara-text-secondary); font-size:0.9rem;">
          Complete a practice session to see your report here.
        </div>
        <ion-button fill="outline" (click)="goToProgress()">View Progress</ion-button>
      </div>
    </ion-content>
    }
  `,
  styles: [`
    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      border: 3px solid;
      font-size: 2rem;
      font-weight: 900;
      margin: 0 auto 1rem;
    }
    .metric-value { font-size: 2rem; font-weight: 800; }
    .metric-label { font-size: 0.8rem; color: var(--swara-text-muted); margin-top: 0.25rem; }
    .swara-progress-bar { height: 0.5rem; background: var(--swara-surface-alt); border-radius: 999px; overflow: hidden; }
    .swara-progress-fill { height: 100%; border-radius: 999px; transition: width 0.6s ease; }
  `],
})
export class SessionReportPage implements OnInit {
  private route     = inject(ActivatedRoute);
  private router    = inject(Router);
  private cdr       = inject(ChangeDetectorRef);
  private analytics = inject(AnalyticsService);

  constructor() {
    addIcons({ sparklesOutline, refreshOutline, barChartOutline });
  }

  report: SessionReportData | null = null;
  grade: Grade = { label: 'C', color: '#FFC107' };
  raga: RagaDefinition | null = null;
  noteList: { name: string; value: number }[] = [];
  formattedDuration = '';

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { report?: SessionReportData } | undefined;
    if (state?.report) {
      this.loadReport(state.report);
    }
    // If no report data was passed (direct navigation, page refresh, etc.),
    // leave report as null — the template renders an empty state via @if (report).
  }

  private loadReport(report: SessionReportData) {
    this.report            = report;
    this.grade             = getGrade(report.score);
    this.formattedDuration = formatDuration(report.duration);
    this.raga              = (report.raagaId ? RAGAS[report.raagaId] : undefined) ?? null;
    this.noteList          = Object.entries(report.noteAccuracies)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    this.analytics.logEvent('session_report_viewed', {
      mode:  report.mode,
      score: report.score,
      ...(report.raagaId ? { raaga_id: report.raagaId } : {}),
    });
    this.cdr.markForCheck();
  }

  noteColor(pct: number): string {
    if (pct >= 85) return '#4CAF50';
    if (pct >= 65) return '#7C4DFF';
    if (pct >= 45) return '#FFC107';
    return '#F44336';
  }

  practiceAgain() {
    this.router.navigate(['/tabs/practice']);
  }

  goToProgress() {
    this.router.navigate(['/tabs/progress']);
  }
}
