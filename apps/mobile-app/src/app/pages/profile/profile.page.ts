import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner,
  ViewWillEnter, ActionSheetController, AlertController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  personCircle, trendingUp, flame, musicalNote,
  settingsOutline, chevronForward, logOutOutline,
  checkmarkCircle, school, mic, cameraOutline, warningOutline
} from 'ionicons/icons';
import { filter, take } from 'rxjs/operators';
import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { AuthService } from '@voice-tuner/auth';
import { ApiService, UserProfile, StreaksResponse } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { compressProfilePhoto } from '../../core/utils/image-compress';
interface Achievement {
  icon: string;
  label: string;
  desc: string;
  unlocked: boolean;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink, AsyncPipe,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon, IonSpinner
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Profile</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="profile-page">

        <!-- ── Authenticated View ──────────────────────────── -->
        @if (authService.user$ | async; as user) {

          <!-- Loading state -->
          @if (loading) {
            <div class="profile-loading">
              <ion-spinner name="crescent"></ion-spinner>
            </div>
          } @else {

            <!-- Email not verified banner -->
            @if (!(user.emailVerified)) {
            <div class="unverified-banner swara-card">
              <ion-icon name="warning-outline" class="unverified-banner__icon"></ion-icon>
              <div class="unverified-banner__body">
                <div class="unverified-banner__title">Email not verified</div>
                <div class="unverified-banner__desc">Verify your email to save sessions and unlock all features.</div>
              </div>
              <button class="unverified-banner__btn" (click)="verifyEmail()">Verify</button>
            </div>
            }

            <!-- Avatar + Name -->
            <div class="profile-hero">
              <div class="avatar-wrap" (click)="changePhoto()">
                @if (profile?.photoUrl) {
                <img [src]="profile.photoUrl" class="avatar-img" alt="Profile photo" />
                } @else {
                <div class="avatar-initial">{{ user.name?.[0]?.toUpperCase() ?? 'U' }}</div>
                }
                <div class="avatar-edit-badge">
                  <ion-icon name="camera-outline"></ion-icon>
                </div>
                @if (uploading) {
                <ion-spinner name="crescent" class="avatar-spinner"></ion-spinner>
                }
              </div>
              <div class="profile-info">
                <div class="profile-name">{{ user.name }}</div>
                <div class="profile-email">{{ user.email }}</div>
                <div class="profile-since">{{ practicingSince }}</div>
              </div>
            </div>

            <!-- Key Stats -->
            <div class="stats-row">
              <div class="swara-stat-card">
                <div class="stat-value">{{ profile?.stats?.totalSessions ?? 0 }}</div>
                <div class="stat-label">Sessions</div>
              </div>
              <div class="swara-stat-card">
                <div class="stat-value">{{ (profile?.stats?.currentStreak ?? 0) }}🔥</div>
                <div class="stat-label">Day Streak</div>
              </div>
              <div class="swara-stat-card">
                <div class="stat-value">{{ avgScoreLabel }}</div>
                <div class="stat-label">Avg Score</div>
              </div>
            </div>

            <!-- Total Practice Time -->
            <div class="swara-card time-card">
              <div class="time-card__left">
                <div class="time-card__value">{{ practiceTimeLabel }}</div>
                <div class="time-card__label">Total practice time</div>
                <div class="time-card__goal">Goal: {{ dailyGoalLabel }}</div>
              </div>
              <div class="time-card__right">
                <div class="time-ring">
                  <svg viewBox="0 0 60 60">
                    <circle cx="30" cy="30" r="24" fill="none"
                      stroke="var(--swara-border)" stroke-width="5"/>
                    <circle cx="30" cy="30" r="24" fill="none"
                      stroke="url(#tGrad)" stroke-width="5"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="ringDash"
                      stroke-dashoffset="-38"
                      transform="rotate(-90 30 30)"/>
                    <defs>
                      <linearGradient id="tGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#7C4DFF"/>
                        <stop offset="100%" stop-color="#00E5C2"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <span class="time-ring__label">{{ monthlyGoalPct }}%</span>
                </div>
                <div class="time-ring-sub">Monthly goal</div>
              </div>
            </div>

            <!-- Achievements -->
            <div class="section">
              <div class="section-label">Achievements</div>
              <div class="achievements-grid">
                @for (a of achievements; track a.label) {
                <div
                  class="achievement-chip"
                  [class.unlocked]="a.unlocked"
                >
                  <span class="achievement-icon">{{ a.icon }}</span>
                  <span class="achievement-label">{{ a.label }}</span>
                  @if (a.unlocked) {
                  <ion-icon name="checkmark-circle" class="achievement-check"></ion-icon>
                  }
                </div>
                }
              </div>
            </div>

            <!-- Quick Links -->
            <div class="section">
              <div class="section-label">Account</div>
              <div class="menu-list">
                <a class="menu-row swara-card" [routerLink]="['/progress']">
                  <ion-icon name="trending-up" class="menu-icon menu-icon--purple"></ion-icon>
                  <div class="menu-text">
                    <div class="menu-title">My Progress</div>
                    <div class="menu-sub">Full practice history &amp; analytics</div>
                  </div>
                  <ion-icon name="chevron-forward" class="menu-chevron"></ion-icon>
                </a>
                <a class="menu-row swara-card" [routerLink]="['/settings']">
                  <ion-icon name="settings-outline" class="menu-icon menu-icon--gray"></ion-icon>
                  <div class="menu-text">
                    <div class="menu-title">Settings</div>
                    <div class="menu-sub">Audio, notifications, appearance</div>
                  </div>
                  <ion-icon name="chevron-forward" class="menu-chevron"></ion-icon>
                </a>
              </div>
            </div>

            <!-- Sign Out -->
            <button class="signout-btn" (click)="signOut()">
              <ion-icon name="log-out-outline"></ion-icon>
              Sign Out
            </button>

          }

        } @else {

          <!-- ── Guest View ───────────────────────────────────── -->

          <!-- Verify email banner (shown after sign up before confirmation) -->
          @if (authService.pendingConfirmationEmail(); as pendingEmail) {
          <div class="verify-banner swara-card">
            <div class="verify-banner__icon">✉️</div>
            <div class="verify-banner__body">
              <div class="verify-banner__title">Check your email</div>
              <div class="verify-banner__desc">
                We sent a confirmation link to <strong>{{ pendingEmail }}</strong>.
                Click it to activate your account, then sign in.
              </div>
            </div>
            <button class="verify-banner__resend link-btn" (click)="resendConfirmation()" [disabled]="resendLoading">
              {{ resendLoading ? 'Sending…' : 'Resend' }}
            </button>
          </div>
          }

          <div class="guest-hero">
            <div class="guest-avatar-wrap">
              <ion-icon name="person-circle" class="guest-avatar-icon"></ion-icon>
            </div>
            <div class="guest-title">Guest Practitioner</div>
            <div class="guest-sub">Your progress isn't being saved</div>
          </div>

          <div class="swara-card upsell-card">
            <div class="upsell-headline">Unlock Your Full Journey</div>
            <p class="upsell-desc">
              Sign in to save sessions, track streaks, analyse note accuracy,
              and get AI-powered weekly feedback — synced across all your devices.
            </p>

            <div class="upsell-features">
              <div class="upsell-feature"><span>🔥</span><span>Daily streak tracking</span></div>
              <div class="upsell-feature"><span>📊</span><span>Note-by-note accuracy history</span></div>
              <div class="upsell-feature"><span>🤖</span><span>AI coach weekly summary</span></div>
              <div class="upsell-feature"><span>🏆</span><span>Achievements &amp; milestones</span></div>
              <div class="upsell-feature"><span>📱</span><span>Sync across all your devices</span></div>
            </div>

            <a [routerLink]="['/login']" class="swara-btn swara-btn--primary upsell-cta">
              Sign In — It's Free
            </a>
            <div class="upsell-fine">No credit card required · Practice offline anytime</div>
          </div>

          <!-- Blurred preview of what they'd see -->
          <div class="section">
            <div class="section-label">Your stats (sign in to unlock)</div>
            <div class="preview-stats">
              <div class="preview-stat swara-card">
                <div class="preview-val">?</div>
                <div class="preview-label">Day Streak</div>
              </div>
              <div class="preview-stat swara-card">
                <div class="preview-val">?</div>
                <div class="preview-label">Sessions</div>
              </div>
              <div class="preview-stat swara-card">
                <div class="preview-val">?</div>
                <div class="preview-label">Avg Score</div>
              </div>
            </div>
          </div>

        }
      </div>
    </ion-content>
  `,
  styleUrls: ['./profile.page.scss']
})
export class ProfilePage implements OnInit, ViewWillEnter {
  readonly authService = inject(AuthService);
  readonly api = inject(ApiService);
  readonly analytics = inject(AnalyticsService);
  readonly actionSheet = inject(ActionSheetController);
  readonly alertCtrl = inject(AlertController);
  readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly _icons = (() => addIcons({
    personCircle, trendingUp, flame, musicalNote,
    settingsOutline, chevronForward, logOutOutline,
    checkmarkCircle, school, mic, cameraOutline, warningOutline
  }))();

  resendLoading = false;
  loading = false;
  uploading = false;

  profile: UserProfile | null = null;
  streaks: StreaksResponse | null = null;

  // ── Derived display values ────────────────────────────────────────────────

  get practicingSince(): string {
    if (!this.profile?.createdAt) return '';
    const d = new Date(this.profile.createdAt);
    return 'Practicing since ' + d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
  }

  get avgScoreLabel(): string {
    const score = this.profile?.stats?.overallScore;
    return score != null && score > 0 ? Math.round(score) + '%' : '–%';
  }

  get practiceTimeLabel(): string {
    const mins = this.profile?.stats?.totalMinutes ?? 0;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  get dailyGoalLabel(): string {
    const goal = this.profile?.preferences?.dailyGoalMinutes ?? 30;
    const monthlyGoalMins = goal * 30;
    const h = Math.floor(monthlyGoalMins / 60);
    return `${h}h / month`;
  }

  /** Percentage of monthly goal achieved (0–100, capped at 100) */
  get monthlyGoalPct(): number {
    const totalMins = this.profile?.stats?.totalMinutes ?? 0;
    const dailyGoal = this.profile?.preferences?.dailyGoalMinutes ?? 30;
    const monthlyGoalMins = dailyGoal * 30;
    // Only count current month minutes (approximation: use totalMinutes for now)
    return Math.min(100, Math.round((totalMins / monthlyGoalMins) * 100));
  }

  /**
   * SVG stroke-dasharray for the ring.
   * Circumference of r=24 circle ≈ 150.8. We map pct → filled arc length.
   */
  get ringDash(): string {
    const circ = 2 * Math.PI * 24; // ≈ 150.8
    const filled = (this.monthlyGoalPct / 100) * circ;
    const empty = circ - filled;
    return `${filled.toFixed(1)} ${empty.toFixed(1)}`;
  }

  get achievements(): Achievement[] {
    const totalSessions = this.profile?.stats?.totalSessions ?? 0;
    const streak        = this.profile?.stats?.currentStreak ?? 0;
    const longestStreak = this.profile?.stats?.longestStreak ?? 0;
    const overallScore  = this.profile?.stats?.overallScore  ?? 0;

    return [
      { icon: '🎵', label: 'First Note',    desc: 'Completed first pitch detection session', unlocked: totalSessions >= 1      },
      { icon: '🔥', label: '7-Day Streak',  desc: 'Practiced 7 days in a row',               unlocked: longestStreak >= 7      },
      { icon: '🎯', label: 'In Tune',       desc: 'Avg accuracy above 75%',                  unlocked: overallScore >= 75      },
      { icon: '🏆', label: 'Yaman Master',  desc: 'Scored 90%+ on Yaman three times',        unlocked: overallScore >= 90      },
      { icon: '⭐', label: '30-Day Streak', desc: 'Practiced 30 days in a row',              unlocked: longestStreak >= 30     },
      { icon: '🎓', label: 'Guru Student',  desc: 'Completed 10 sessions',                   unlocked: totalSessions >= 10     },
    ];
  }

  // constructor removed - using `inject()` for dependencies

  ngOnInit(): void {
    // Initial load: wait for auth to be ready, then fetch data once.
    this.authService.isAuthenticated$.pipe(
      filter((isAuth): isAuth is true => isAuth === true),
      take(1)
    ).subscribe(() => this.loadData());
  }

  ionViewWillEnter(): void {
    // Reload data every time the tab becomes visible (Ionic caches tab pages).
    this.authService.isAuthenticated$.pipe(
      filter((isAuth): isAuth is true => isAuth === true),
      take(1)
    ).subscribe(() => this.loadData());
  }

  private async loadData(): Promise<void> {
    this.loading = true;
    this.cdr.markForCheck();
    try {
      const [profile, streaks] = await Promise.all([
        this.api.getProfile(),
        this.api.getStreaks(),
      ]);
      this.profile = profile;
      this.streaks = streaks;
      // Associate analytics events with the logged-in user
      if (profile?.userId) {
        this.analytics.setUserId(profile.userId);
      }
      // Set persistent user properties for segmentation in Firebase Analytics
      const daysSinceSignup = profile?.createdAt
        ? Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000)
        : 0;
      this.analytics.setUserProperties({
        practice_streak:  profile?.stats?.currentStreak ?? 0,
        subscription_tier: 'free',
        days_since_signup: daysSinceSignup,
      });
    } catch (err) {
      console.error('[ProfilePage] loadData error', err);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async changePhoto(): Promise<void> {
    if (this.uploading) return;

    // On native, show action sheet with Camera + Gallery; on web, use gallery only
    const isNative = Capacitor.isNativePlatform();

    let source: CameraSource;
    if (isNative) {
      let picked: CameraSource | null = null;
      const sheet = await this.actionSheet.create({
        header: 'Profile Photo',
        buttons: [
          { text: 'Take Photo',          icon: 'camera-outline', handler: () => { picked = CameraSource.Camera; } },
          { text: 'Choose from Gallery',  icon: 'image-outline',  handler: () => { picked = CameraSource.Photos; } },
          { text: 'Cancel', role: 'cancel' },
        ],
      });
      await sheet.present();
      await sheet.onDidDismiss();
      if (picked === null) return;
      source = picked;
    } else {
      source = CameraSource.Photos;
    }

    try {
      // Capture / pick image as a base64 data URI
      const photo = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source,
        width: 512,   // cap source to prevent huge images
        height: 512,
      });

      if (!photo.dataUrl) return;

      this.uploading = true;
      this.cdr.markForCheck();

      // Compress to a small JPEG (256px max, ~0.7 quality → ~10-30 KB)
      const blob = await compressProfilePhoto(photo.dataUrl, {
        maxSize: 256,
        quality: 0.7,
      });

      // Get presigned upload URL from backend
      const { uploadUrl, cdnUrl } = await this.api.getUploadUrl('image/jpeg');

      // Upload directly to S3 via presigned URL
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/jpeg' },
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`S3 upload failed: ${uploadRes.status}`);
      }

      // Cache-bust: append timestamp to CDN URL
      const photoUrl = `${cdnUrl}?t=${Date.now()}`;

      // Save photoUrl to user profile in DynamoDB
      await this.api.updatePhotoUrl(photoUrl);

      // Update local state
      if (this.profile) {
        this.profile = { ...this.profile, photoUrl };
      }

      this.analytics.logEvent('profile_photo_updated');
    } catch (err: any) {
      console.error('[ProfilePage] changePhoto error', err);
      const msg: string = err?.message || String(err);
      // Silently ignore user-initiated dismissals and permission denials —
      // these are expected interactions, not errors worth surfacing.
      const isSilent = [
        'cancel', 'dismiss', 'no image picked',
        'user denied', 'access denied', 'permission denied',
      ].some(s => msg.toLowerCase().includes(s));
      if (!isSilent) {
        const alert = await this.alertCtrl.create({
          header: 'Photo Upload Failed',
          message: msg,
          buttons: ['OK'],
        });
        await alert.present();
      }
    } finally {
      this.uploading = false;
      this.cdr.markForCheck();
    }
  }

  verifyEmail(): void {
    const email = this.authService.currentUser?.email ?? '';
    this.authService.resendConfirmation(email).catch(() => {});
    this.router.navigate(['/verify-email'], { state: { email } });
  }

  async signOut(): Promise<void> {
    this.analytics.logEvent('sign_out');
    this.analytics.setUserId(null);
    await this.authService.signOut();
    this.cdr.markForCheck();
  }

  async resendConfirmation(): Promise<void> {
    // pendingConfirmationEmail is a Signal<string | null>
    const email = typeof this.authService.pendingConfirmationEmail === 'function'
      ? this.authService.pendingConfirmationEmail()
      : (this.authService.pendingConfirmationEmail as unknown as string | null);
    if (!email) return;
    this.resendLoading = true;
    this.cdr.markForCheck();
    try {
      await this.authService.resendConfirmation(email);
    } finally {
      this.resendLoading = false;
      this.cdr.markForCheck();
    }
  }
}
