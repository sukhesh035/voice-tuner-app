import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, OnDestroy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  musicalNote, mic, flame, trendingUp, sparkles, lockClosed, personCircle
} from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { ApiService, PracticeSession } from '../../core/services/api.service';
import { TanpuraPlayerService, Instrument } from '@voice-tuner/tanpura-player';
import { MELAKARTA_LIST } from '@voice-tuner/training-engine';
import { filter, take, map } from 'rxjs/operators';
import { Subscription } from 'rxjs';
import { ViewWillEnter } from '@ionic/angular';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner,
    AsyncPipe
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Swara AI</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="home-page">

        <!-- Hero -->
        <div class="hero-section">
          @if (authService.user$ | async; as user) {
            <div class="hero-greeting">{{ greeting }}, {{ user.name }}</div>
          } @else {
            <div class="hero-greeting">{{ greeting }}, रियाज़ करें</div>
          }

          <div class="hero-title">
            Your Daily<br />
            <span class="hero-highlight">Riyaz Companion ✦</span>
          </div>

          @if (authService.isAuthenticated$ | async) {
            <div class="swara-streak-badge">
              <span class="streak-icon">🔥</span>
              @if (!loading) {
                <span>{{ streakLabel }}</span>
              } @else {
                <ion-spinner name="dots" style="--color:#fff;width:24px;height:16px"></ion-spinner>
              }
            </div>
          } @else {
            <a class="swara-streak-badge swara-streak-badge--guest" [routerLink]="['/login']">
              <span class="streak-icon">🔥</span>
              <span>Sign in to track streak</span>
            </a>
          }
        </div>

        <!-- Quick Actions -->
        <div class="quick-actions">
          <div class="section-label">Quick Start</div>
          <div class="action-grid">
            <a class="action-card swara-card" [routerLink]="['/tanpura']">
              <div class="action-card__icon tanpura-icon">
                <ion-icon name="musical-note"></ion-icon>
              </div>
              <div class="action-card__text">
                <div class="action-card__label">{{ droneLabel }}</div>
                <div class="action-card__sub">Drone Player</div>
              </div>
            </a>
            <a class="action-card swara-card" [routerLink]="['/sing']">
              <div class="action-card__icon sing-icon">
                <ion-icon name="mic"></ion-icon>
              </div>
              <div class="action-card__text">
                <div class="action-card__label">Sing</div>
                <div class="action-card__sub">Pitch Detection</div>
              </div>
            </a>
            <a class="action-card swara-card" [routerLink]="['/practice']">
              <div class="action-card__icon practice-icon">
                <ion-icon name="sparkles"></ion-icon>
              </div>
              <div class="action-card__text">
                <div class="action-card__label">Practice</div>
                <div class="action-card__sub">Raga Trainer</div>
              </div>
            </a>

          </div>
        </div>

        <!-- Today's Practice -->
        <div class="today-section">
          <div class="section-label">Today's Practice</div>
          @if (authService.isAuthenticated$ | async) {
            <div class="swara-card today-card">
              @if (!loading) {
                <div class="today-stats">
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todayMinutes }}</div>
                    <div class="today-stat__label">Min</div>
                  </div>
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todayAccuracy }}</div>
                    <div class="today-stat__label">Acc</div>
                  </div>
                  <div class="today-stat">
                    <div class="today-stat__value">{{ todaySessions }}</div>
                    <div class="today-stat__label">Sessions</div>
                  </div>
                </div>
              } @else {
                <div class="today-loading">
                  <ion-spinner name="crescent"></ion-spinner>
                </div>
              }
              <a [routerLink]="['/practice']" class="swara-btn swara-btn--primary today-btn">
                {{ todaySessions > 0 ? 'Continue' : 'Start Riyaz' }}
              </a>
            </div>
          } @else {
            <div class="swara-card today-card today-card--locked">
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
                <a [routerLink]="['/practice']" class="swara-btn swara-btn--primary">
                  Start Riyaz
                </a>
              </div>
            </div>
          }
        </div>

        <!-- Raga of the Day -->
        <div class="raga-day-section">
          <div class="section-label">Raga of the Day</div>
          <div class="swara-card raga-day-card">
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

          @if (authService.isAuthenticated$ | async) {
            @if (!loading) {
              <div class="weekly-bars">
                @for (day of weekDays; track day; let i = $index) {
                <div class="day-bar">
                  <div class="day-bar__fill" [style.height]="weekData[i] + '%'">
                    <div class="day-bar__glow"></div>
                  </div>
                  <div class="day-bar__label">{{ day }}</div>
                </div>
                }
              </div>
            } @else {
              <div class="weekly-loading">
                <ion-spinner name="crescent"></ion-spinner>
              </div>
            }
          } @else {
            <a class="swara-card weekly-locked-card" [routerLink]="['/login']">
              <div class="weekly-locked-bars" aria-hidden="true">
                @for (h of lockedBarHeights; track h) {
                <div class="day-bar-ghost" [style.height]="h + '%'"></div>
                }
              </div>
              <div class="weekly-locked-overlay">
                <ion-icon name="lock-closed" class="lock-icon"></ion-icon>
                <div class="weekly-locked-title">Track Your Progress</div>
                <div class="weekly-locked-sub">Sign in to see your weekly practice history</div>
                <span class="swara-btn swara-btn--primary weekly-locked-btn">Sign In Free</span>
              </div>
            </a>
          }
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage implements OnInit, OnDestroy, ViewWillEnter {
  readonly weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  // Ghost bars behind the lock — randomised-looking but fixed so no flicker
  readonly lockedBarHeights = [45, 70, 30, 85, 60, 50, 20];
  readonly ragaOfDay = (() => {
    // Days elapsed since a fixed epoch (2024-01-01) so the index advances by
    // one each calendar day and cycles through all 72 Melakarta ragas before repeating.
    const EPOCH = Date.UTC(2024, 0, 1);
    const dayIndex = Math.floor((Date.now() - EPOCH) / 86_400_000);
    const raga = MELAKARTA_LIST[((dayIndex % MELAKARTA_LIST.length) + MELAKARTA_LIST.length) % MELAKARTA_LIST.length];
    return { name: raga.englishName, hindi: raga.name, time: raga.time, desc: raga.description };
  })();

  private static readonly INSTRUMENT_LABELS: Record<Instrument, string> = {
    tanpura: 'Tanpura', keyboard: 'Keyboard', guitar: 'Guitar'
  };

  loading = false;
  droneLabel = 'Tanpura';
  private instrumentSub?: Subscription;
  private authSub?: Subscription;

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

  readonly authService = inject(AuthService);
  readonly api = inject(ApiService);
  readonly tanpuraPlayer = inject(TanpuraPlayerService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly _icons = (() => addIcons({ musicalNote, mic, flame, trendingUp, sparkles, lockClosed, personCircle }))();

  private isAuthenticated = false;

  ngOnInit(): void {
    // Track instrument changes for dynamic drone label
    this.instrumentSub = this.tanpuraPlayer.state$.pipe(
      map(s => s.instrument)
    ).subscribe(inst => {
      this.droneLabel = HomePage.INSTRUMENT_LABELS[inst] ?? 'Tanpura';
      this.cdr.markForCheck();
    });

    // Wait for Cognito session restore once, then track auth state for
    // subsequent ionViewWillEnter calls to know whether to reload.
      this.authService.initialized$.pipe(
        take(1)
      ).subscribe(() => {
        this.authSub = this.authService.isAuthenticated$.subscribe(isAuth => {
          this.isAuthenticated = isAuth;
        });
      });
  }

  /** Fires every time the tab becomes visible — reload data so stats are fresh. */
  ionViewWillEnter(): void {
    this.authService.initialized$.pipe(
      take(1)
    ).subscribe(() => {
      this.authService.isAuthenticated$.pipe(
        filter((isAuth): isAuth is true => isAuth === true),
        take(1)
      ).subscribe(() => this.loadData());
    });
  }

  ngOnDestroy(): void {
    this.instrumentSub?.unsubscribe();
    this.authSub?.unsubscribe();
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
