import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  moonOutline, flashOutline, musicalNoteOutline, notificationsOutline,
  informationCircleOutline, documentTextOutline, shieldCheckmarkOutline,
  heartOutline, chevronForwardOutline
} from 'ionicons/icons';
import { ThemeService } from '../../core/services/theme.service';
import { ApiService, UserPreferences } from '../../core/services/api.service';
import { TanpuraPlayerService, Instrument } from '@voice-tuner/tanpura-player';
import { AuthService } from '@voice-tuner/auth';
import { filter, take } from 'rxjs/operators';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonToggle, IonIcon],
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
})
export class SettingsPage {
  lowLatency     = false;
  useSamples     = true;
  sensitivity    = 'medium';
  showHz         = true;
  dailyReminder  = true;

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
    private tanpura: TanpuraPlayerService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private analytics: AnalyticsService
  ) {
    addIcons({
      moonOutline, flashOutline, musicalNoteOutline, notificationsOutline,
      informationCircleOutline, documentTextOutline, shieldCheckmarkOutline,
      heartOutline, chevronForwardOutline
    });
  }

  ionViewWillEnter(): void {
    this.loadPreferences();
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
