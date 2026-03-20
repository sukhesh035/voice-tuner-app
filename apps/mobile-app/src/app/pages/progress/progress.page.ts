import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner,
  ViewWillEnter
} from '@ionic/angular/standalone';
import { filter, take } from 'rxjs/operators';
import { AuthService } from '@voice-tuner/auth';
import { ApiService, PracticeSession, UserProfile, StreaksResponse } from '../../core/services/api.service';

interface WeeklyProgress { day: string; accuracy: number; minutes: number; }
interface RecentSession  { raga: string; date: string; duration: number; accuracy: number; }

@Component({
  selector: 'app-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonSpinner],
  templateUrl: './progress.page.html',
  styleUrls: ['./progress.page.scss'],
})
export class ProgressPage implements OnInit, ViewWillEnter {
  loading = false;

  // Derived display data
  overallScore  = 0;
  streakDays    = 0;
  weeklyData:    WeeklyProgress[] = [];
  recentSessions: RecentSession[] = [];

  // Note accuracy is not available per-note from the backend yet —
  // keep placeholder but driven by overallScore so it's not random.
  get noteAccuracy() {
    const base = this.overallScore;
    return [
      { note: 'Sa',  accuracy: Math.min(100, Math.round(base * 1.10)), color: '#FF6B6B' },
      { note: 'Re',  accuracy: Math.min(100, Math.round(base * 0.94)), color: '#FF8E53' },
      { note: 'Ga',  accuracy: Math.min(100, Math.round(base * 0.77)), color: '#FFC300' },
      { note: 'Ma',  accuracy: Math.min(100, Math.round(base * 1.00)), color: '#4CAF50' },
      { note: 'Pa',  accuracy: Math.min(100, Math.round(base * 1.06)), color: '#2196F3' },
      { note: 'Dha', accuracy: Math.min(100, Math.round(base * 0.87)), color: '#9C27B0' },
      { note: 'Ni',  accuracy: Math.min(100, Math.round(base * 0.85)), color: '#E91E63' },
    ];
  }

  // SVG ring for overall score
  get scoreDashArray(): string {
    const circ   = 2 * Math.PI * 50; // r=50
    const filled = (this.overallScore / 100) * circ;
    return `${filled.toFixed(1)} ${(circ - filled).toFixed(1)}`;
  }

  constructor(
    public authService: AuthService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.pipe(
      filter((v): v is true => v === true),
      take(1)
    ).subscribe(() => this.loadData());
  }

  ionViewWillEnter(): void {
    // Reload data every time the tab becomes visible (Ionic caches tab pages).
    this.authService.isAuthenticated$.pipe(
      filter((v): v is true => v === true),
      take(1)
    ).subscribe(() => this.loadData());
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [profile, streaks, sessionsRes] = await Promise.all([
        this.api.getProfile(),
        this.api.getStreaks(),
        this.api.getSessions(50),
      ]);

      this.overallScore = Math.round(profile.stats?.overallScore ?? 0);
      this.streakDays   = streaks.streak ?? 0;
      this.weeklyData   = this.buildWeeklyData(streaks, sessionsRes.sessions);
      this.recentSessions = this.buildRecentSessions(sessionsRes.sessions);
    } catch (err) {
      console.error('[ProgressPage] loadData error', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  private buildWeeklyData(streaks: StreaksResponse, sessions: PracticeSession[]): WeeklyProgress[] {
    const today      = new Date();
    const dayOfWeek  = today.getDay(); // 0=Sun
    const mondayOff  = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday     = new Date(today);
    monday.setDate(today.getDate() + mondayOff);
    monday.setHours(0, 0, 0, 0);

    const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr  = d.toISOString().slice(0, 10);
      const daySessions = sessions.filter(s => s.createdAt.slice(0, 10) === dateStr);
      const minutes  = Math.round(daySessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60);
      const accuracies = daySessions.map(s => s.avgAccuracy).filter(a => a > 0);
      const accuracy = accuracies.length
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length)
        : 0;
      return { day: DAY_LABELS[i], accuracy, minutes };
    });
  }

  private buildRecentSessions(sessions: PracticeSession[]): RecentSession[] {
    const today     = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    return sessions.slice(0, 10).map(s => {
      const d    = new Date(s.createdAt);
      d.setHours(0, 0, 0, 0);
      let date: string;
      if (d.getTime() === today.getTime())           date = 'Today';
      else if (d.getTime() === yesterday.getTime())  date = 'Yesterday';
      else {
        const diffDays = Math.round((today.getTime() - d.getTime()) / 86400000);
        date = `${diffDays} days ago`;
      }
      const raga = s.raagaId
        ? s.raagaId.charAt(0).toUpperCase() + s.raagaId.slice(1)
        : (s.mode === 'free' ? 'Free Practice' : s.mode ?? 'Practice');
      return {
        raga,
        date,
        duration: Math.round((s.duration ?? 0) / 60),
        accuracy: Math.round(s.avgAccuracy ?? 0),
      };
    });
  }

  scoreColor(acc: number): string {
    if (acc >= 85) return 'var(--swara-pitch-perfect)';
    if (acc >= 70) return 'var(--swara-pitch-close)';
    return 'var(--swara-pitch-off)';
  }
}
