import { Component, ChangeDetectionStrategy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon, AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  moonOutline, flashOutline, musicalNoteOutline, notificationsOutline,
  informationCircleOutline, documentTextOutline, shieldCheckmarkOutline,
  heartOutline, chevronForwardOutline, micOutline, lockClosedOutline, trashOutline
} from 'ionicons/icons';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { ThemeService } from '../../core/services/theme.service';
import { ApiService, UserPreferences } from '../../core/services/api.service';
import { PushNotificationService } from '../../core/services/push-notification.service';
import { PermissionsService, PermissionState } from '../../core/services/permissions.service';
import { TanpuraPlayerService, Instrument } from '@voice-tuner/tanpura-player';
import { AuthService } from '@voice-tuner/auth';
import { filter, take } from 'rxjs/operators';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RouterLink, IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
  private readonly alertCtrl = inject(AlertController);
  lowLatency     = false;
  useSamples     = true;
  sensitivity    = 'medium';
  showHz         = true;
  dailyReminder  = true;

  micPermission: PermissionState = 'prompt';
  notificationPermission: PermissionState = 'prompt';
  appVersion = '';

  selectedInstrument: Instrument = 'tanpura';
  private prefsLoaded = false;

  readonly instruments: { id: Instrument; label: string; icon: string; desc: string }[] = [
    { id: 'tanpura',  label: 'Tanpura',  icon: 'tanpura-icon',  desc: 'Traditional Indian drone' },
    { id: 'keyboard', label: 'Keyboard', icon: 'keyboard-icon', desc: 'Clean harmonium tone' },
    { id: 'guitar',   label: 'Guitar',   icon: 'guitar-icon',   desc: 'Plucked string drone' },
  ];

  get isDark(): boolean { return this.themeService.isDark; }

  constructor(
    public themeService: ThemeService,
    private api: ApiService,
    private pushNotification: PushNotificationService,
    private permissionsService: PermissionsService,
    private tanpura: TanpuraPlayerService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService,
    private router: Router,
  ) {
    addIcons({
      moonOutline, flashOutline, musicalNoteOutline, notificationsOutline,
      informationCircleOutline, documentTextOutline, shieldCheckmarkOutline,
      heartOutline, chevronForwardOutline, micOutline, lockClosedOutline, trashOutline
    });
  }

  ionViewWillEnter(): void {
    this.loadPreferences();
    this.loadPermissions();
    this.loadAppVersion();
  }

  toggleTheme(event: Event): void {
    const checked = (event as CustomEvent).detail.checked as boolean;
    this.themeService.setTheme(checked ? 'dark' : 'light');
    this.analytics.logEvent('theme_changed', { theme: checked ? 'dark' : 'light' });
    this.persistPreference({ theme: checked ? 'dark' : 'light' });
  }

  selectInstrument(instrument: Instrument): void {
    if (instrument === this.selectedInstrument) return;
    this.selectedInstrument = instrument;
    this.tanpura.setInstrument(instrument);
    this.analytics.logEvent('instrument_changed', { instrument });
    this.persistPreference({ instrument });
    this.cdr.markForCheck();
  }

  toggleNotifications(event: Event): void {
    const checked = (event as CustomEvent).detail.checked as boolean;
    this.dailyReminder = checked;
    this.persistPreference({ notificationsEnabled: checked });
    if (checked) {
      this.pushNotification.initialize().catch((err) =>
        console.error('[Settings] Push registration failed', err)
      );
    } else {
      this.pushNotification.unregister().catch((err) =>
        console.error('[Settings] Push unregister failed', err)
      );
    }
  }

  async requestMicPermission(): Promise<void> {
    if (this.micPermission === 'granted') return;
    const result = await this.permissionsService.requestMicPermission();
    this.micPermission = result;
    this.analytics.logEvent('mic_permission_requested', { result });
    this.cdr.markForCheck();
  }

  async requestNotificationPermission(): Promise<void> {
    if (this.notificationPermission === 'granted') return;
    const result = await this.permissionsService.requestNotificationPermission();
    this.notificationPermission = result;
    this.dailyReminder = result === 'granted';
    this.analytics.logEvent('notification_permission_requested', { result });
    this.cdr.markForCheck();
  }

  async openAppSettings(): Promise<void> {
    await this.permissionsService.openAppSettings();
  }

  get isAuthenticated$() { return this.authService.isAuthenticated$; }

  changePassword(): void {
    this.analytics.logEvent('change_password_requested');
    this.router.navigate(['/forgot-password']);
  }

  async deleteAccount(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Delete Account',
      message:
        'This will permanently delete your account, all practice sessions, streaks, and data. This cannot be undone.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Delete', role: 'destructive', cssClass: 'danger-button' },
      ],
    });
    await alert.present();

    // Use onDidDismiss instead of an async handler — Ionic does not await
    // async button handlers, so any async work (API calls, navigation) or
    // a subsequent alert created inside the handler may be silently dropped.
    const { role } = await alert.onDidDismiss();
    if (role !== 'destructive') return;

    try {
      await this.api.deleteAccount();
      await this.authService.deleteAccount();
      this.analytics.logEvent('account_deleted');
      this.router.navigate(['/login'], { replaceUrl: true });
    } catch (err) {
      console.error('[Settings] Delete account failed', err);
      const errAlert = await this.alertCtrl.create({
        header: 'Error',
        message: 'Failed to delete account. Please try again.',
        buttons: ['OK'],
      });
      await errAlert.present();
    }
  }

  private async loadAppVersion(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await App.getInfo();
        this.appVersion = info.version;
      }
    } catch {
      // Non-native (web/dev) — leave appVersion empty; template falls back to workspace version
    }
    this.cdr.markForCheck();
  }

  private async loadPermissions(): Promise<void> {
    const { mic, notification } = await this.permissionsService.checkPermissions();
    this.micPermission = mic;
    this.notificationPermission = notification;
    this.cdr.markForCheck();
  }

  private loadPreferences(): void {
    this.authService.initialized$.pipe(take(1)).subscribe(() => {
      this.authService.isAuthenticated$.pipe(
        filter((isAuth): isAuth is true => isAuth === true),
        take(1)
      ).subscribe(async () => {
        try {
          const profile = await this.api.getProfile();
          if (profile.preferences) {
            const p = profile.preferences;
            if (p.instrument) {
              this.selectedInstrument = p.instrument;
              // Sync the tanpura service to match the stored preference
              if (this.tanpura.state.instrument !== p.instrument) {
                this.tanpura.setInstrument(p.instrument);
              }
            }
            if (p.notificationsEnabled !== undefined) {
              this.dailyReminder = p.notificationsEnabled;
            }
          }
          this.prefsLoaded = true;
          this.cdr.markForCheck();
        } catch (err) {
          console.error('[SettingsPage] Failed to load preferences', err);
        }
      });
    });
  }

  private async persistPreference(prefs: Partial<UserPreferences>): Promise<void> {
    try {
      await this.api.updatePreferences(prefs);
    } catch (err) {
      console.error('[SettingsPage] Failed to persist preference', err);
    }
  }
}
