import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  musicalNote, mic, flame, school, trendingUp, sparkles, lockClosed, personCircle
} from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { ApiService, PracticeSession } from '../../core/services/api.service';
import { take } from 'rxjs/operators';

const RAGAS_OF_DAY = [
  { name: 'Yaman',       hindi: 'यमन',       time: '🌆 Evening',   desc: 'The most popular evening raga. Begin with Sa Pa Ni Sa in Alaap.' },
  { name: 'Bhairav',     hindi: 'भैरव',       time: '🌅 Morning',   desc: 'The quintessential morning raga. Start slowly with komal Re and Dha.' },
  { name: 'Hamsadhwani', hindi: 'हंसध्वनि',  time: '🌙 Night',     desc: 'A joyous raga with no Ma and Dha. Perfect for beginners.' },
  { name: 'Bhimpalasi',  hindi: 'भीमपलासी',  time: '🕒 Afternoon', desc: 'An emotional raga of the afternoon — focus on Ga and Ni.' },
  { name: 'Kedar',       hindi: 'केदार',      time: '🌆 Evening',   desc: 'Evening raga with a unique vakra movement through Ma#.' },
  { name: 'Bihag',       hindi: 'बिहाग',     time: '🌙 Night',     desc: 'A romantic late-night raga. Both Ma and Ma# are used.' },
  { name: 'Darbari',     hindi: 'दरबारी',    time: '🌙 Late Night', desc: 'Raga of the royal court. Slow, deep, with heavy Ga and Ni.' },
];

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Sruti</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="home-page">

        <!-- Hero -->
        <div class="hero-section">
          <ng-container *ngIf="authService.user$ | async as user; else guestGreeting">
            <div class="hero-greeting">{{ greeting }}, {{ user.name }}</div>
          </ng-container>
          <ng-template #guestGreeting>
            <div class="hero-greeting">{{ greeting }}, रियाज़ करें</div>
          </ng-template>

          <div class="hero-title">
            Your Daily<br />
            <span class="hero-highlight">Riyaz Companion</span>
          </div>

          <ng-container *ngIf="authService.isAuthenticated$ | async; else streakGuest">
            <div class="sruti-streak-badge">
              <span class="streak-icon">🔥</span>
              <span *ngIf="!loading; else streakLoading">{{ streakLabel }}</span>
              <ng-template #streakLoading><ion-spinner name="dots" style="--color:#fff;width:24px;height:16px"></ion-spinner></ng-template>
            </div>
          </ng-container>
          <ng-template #streakGuest>
            <a class="sruti-streak-badge sruti-streak-badge--guest" [routerLink]="['/login']">
              <span class="streak-icon">🔥</span>
              <span>Sign in to track streak</span>
            </a>
          </ng-template>
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <div class="section-label">Quick Start</div>
          <div class="action-grid">
            <a class="action-card sruti-card" [routerLink]="['/tanpura']">
              <div class="action-card__icon tanpura-icon">
                <ion-icon name="musical-note"></ion-icon>
              </div>
              <div class="action-card__label">Tanpura</div>
              <div class="action-card__sub">Drone Player</div>
            </a>
            <a class="action-card sruti-card" [routerLink]="['/sing']">
              <div class="action-card__icon sing-icon">
                <ion-icon name="mic"></ion-icon>
              </div>
              <div class="action-card__label">Sing</div>
              <div class="action-card__sub">Pitch Detection</div>
            </a>
            <a class="action-card sruti-card" [routerLink]="['/practice']">
              <div class="action-card__icon practice-icon">
                <ion-icon name="sparkles"></ion-icon>
              </div>
              <div class="action-card__label">Practice</div>
              <div class="action-card__sub">Raga Trainer</div>
            </a>
            <a class="action-card sruti-card" [routerLink]="['/guru']">
              <div class="action-card__icon guru-icon">
                <ion-icon name="school"></ion-icon>
              </div>
              <div class="action-card__label">Guru Mode</div>
              <div class="action-card__sub">Classroom</div>
            </a>
          </div>
        </div>

        <!-- Today's Practice -->
        <div class="today-section">
          <div class="section-label">Today's Practice</div>
          <ng-container *ngIf="authService.isAuthenticated$ | async; else todayGuest">
            <div class="sruti-card today-card">
              <ng-container *ngIf="!loading; else todayLoading">
                <div class="today-stats">
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todayMinutes }}</div>
                    <div class="today-stat__label">Minutes</div>
                  </div>
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todayAccuracy }}</div>
                    <div class="today-stat__label">Accuracy</div>
                  </div>
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todaySessions }}</div>
                    <div class="today-stat__label">Sessions</div>
                  </div>
                </div>
              </ng-container>
              <ng-template #todayLoading>
                <div class="today-loading">
                  <ion-spinner name="crescent"></ion-spinner>
                </div>
              </ng-template>
              <div class="today-cta">
                <a [routerLink]="['/practice']" class="sruti-btn sruti-btn--primary">
                  {{ todaySessions > 0 ? 'Continue Riyaz' : 'Start Riyaz' }}
                </a>
              </div>
            </div>
          </ng-container>
          <ng-template #todayGuest>
            <div class="sruti-card today-card today-card--locked">
              <div class="today-stats today-stats--blurred">
                <div class="today-stat">
                  <div class="today-stat__value">––</div>
                  <div class="today-stat__label">Minutes</div>
                </div>
                <div class="today-stat">
                  <div class="today-stat__value">––</div>
                  <div class="today-stat__label">Accuracy</div>
                </div>
                <div class="today-stat">
                  <div class="today-stat__value">––</div>
                  <div class="today-stat__label">Sessions</div>
                </div>
              </div>
              <div class="today-cta">
                <a [routerLink]="['/practice']" class="sruti-btn sruti-btn--primary">
                  Start Riyaz
                </a>
              </div>
            </div>
          </ng-template>
        </div>

        <!-- Raga of the Day -->
        <div class="raga-day-section">
          <div class="section-label">Raga of the Day</div>
          <div class="sruti-card raga-day-card">
            <div class="raga-day-accent"></div>
            <div class="raga-day-content">
              <div class="raga-day-name">{{ ragaOfDay.name }}</div>
              <div class="raga-day-hindi">{{ ragaOfDay.hindi }}</div>
              <div class="raga-day-time">{{ ragaOfDay.time }} Raga</div>
              <div class="raga-day-desc">{{ ragaOfDay.desc }}</div>
            </div>
          </div>
        </div>

        <!-- Weekly Overview -->
        <div class="weekly-section">
          <div class="section-label">This Week</div>

          <ng-container *ngIf="authService.isAuthenticated$ | async; else weeklyGuest">
            <ng-container *ngIf="!loading; else weeklyLoading">
              <div class="weekly-bars">
                <div *ngFor="let day of weekDays; let i = index" class="day-bar">
                  <div class="day-bar__fill" [style.height]="weekData[i] + '%'">
                    <div class="day-bar__glow"></div>
                  </div>
                  <div class="day-bar__label">{{ day }}</div>
                </div>
              </div>
            </ng-container>
            <ng-template #weeklyLoading>
              <div class="weekly-loading">
                <ion-spinner name="crescent"></ion-spinner>
              </div>
            </ng-template>
          </ng-container>

          <ng-template #weeklyGuest>
            <a class="sruti-card weekly-locked-card" [routerLink]="['/login']">
              <div class="weekly-locked-bars" aria-hidden="true">
                <div *ngFor="let h of lockedBarHeights" class="day-bar-ghost" [style.height]="h + '%'"></div>
              </div>
              <div class="weekly-locked-overlay">
                <ion-icon name="lock-closed" class="lock-icon"></ion-icon>
                <div class="weekly-locked-title">Track Your Progress</div>
                <div class="weekly-locked-sub">Sign in to see your weekly practice history</div>
                <span class="sruti-btn sruti-btn--primary weekly-locked-btn">Sign In Free</span>
              </div>
            </a>
          </ng-template>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit {
  readonly weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Ghost bars behind the lock — randomised-looking but fixed so no flicker
  readonly lockedBarHeights = [45, 70, 30, 85, 60, 50, 20];
  readonly ragaOfDay = RAGAS_OF_DAY[new Date().getDay() % RAGAS_OF_DAY.length];

  loading = false;

  // Today's stats
  todayMinutes = 0;
  todayAccuracy = '–%';
  todaySessions = 0;

  // Weekly bars (0–100 scale, represents practice done that day)
  weekData = [0, 0, 0, 0, 0, 0, 0];

  // Streak
  streakLabel = '0 Day Streak';

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 5)  return 'Good Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 21) return 'Good Evening';
    return 'Good Night';
  }

  constructor(
    public authService: AuthService,
    private api: ApiService,
    private cdr: ChangeDetectorRef
  ) {
    addIcons({ musicalNote, mic, flame, school, trendingUp, sparkles, lockClosed, personCircle });
  }

  ngOnInit(): void {
    // Only load if already authenticated (e.g. after session restore on refresh).
    // Also subscribe so if auth state changes (sign in), we reload data.
    this.authService.isAuthenticated$.pipe(take(1)).subscribe(isAuth => {
      if (isAuth) this.loadData();
    });
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();

    try {
      const [streaksRes, sessionsRes] = await Promise.all([
        this.api.getStreaks(),
        this.api.getSessions(50),
      ]);

      // ── Streak label ──────────────────────────────────────
      const s = streaksRes.streak ?? 0;
      this.streakLabel = `${s} Day Streak`;

      // ── Weekly bars ───────────────────────────────────────
      // Build a Set of YYYY-MM-DD strings for the last 7 days (Mon–Sun of current week)
      this.weekData = this.buildWeekBars(streaksRes.practiceDays, sessionsRes.sessions);

      // ── Today's stats ─────────────────────────────────────
      const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      const todaySessions = sessionsRes.sessions.filter(
        sess => sess.createdAt.slice(0, 10) === todayStr
      );
      this.todaySessions = todaySessions.length;
      this.todayMinutes  = Math.round(
        todaySessions.reduce((sum, s) => sum + (s.duration ?? 0), 0) / 60
      );
      const accuracies = todaySessions.map(s => s.avgAccuracy).filter(a => a != null && a > 0);
      this.todayAccuracy = accuracies.length
        ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) + '%'
        : '–%';
    } catch (err) {
      console.error('[HomePage] loadData error', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Returns a 7-element array (Mon=0 … Sun=6) where each value is a 0–100
   * percentage indicating whether the user practiced that day this week.
   * Uses `practiceDays` for presence, and `sessions` for relative duration scaling.
   */
  private buildWeekBars(practiceDays: string[], sessions: PracticeSession[]): number[] {
    // Find the Monday of the current week
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun … 6=Sat
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    // Build YYYY-MM-DD strings for Mon–Sun
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d.toISOString().slice(0, 10);
    });

    // Sum duration per day from sessions
    const durationByDay: Record<string, number> = {};
    for (const sess of sessions) {
      const day = sess.createdAt.slice(0, 10);
      durationByDay[day] = (durationByDay[day] ?? 0) + (sess.duration ?? 0);
    }

    // Normalise: max duration this week = 100%
    const practiceDaySet = new Set(practiceDays);
    const weekDurations = weekDates.map(d =>
      practiceDaySet.has(d) ? (durationByDay[d] ?? 60) : 0  // default 60s if day known but no sessions
    );
    const maxDur = Math.max(...weekDurations, 1);

    return weekDurations.map(dur => Math.round((dur / maxDur) * 100));
  }
}
