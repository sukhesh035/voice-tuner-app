import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonToggle } from '@ionic/angular/standalone';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonToggle],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <div class="settings-page">

        <div class="settings-group">
          <div class="group-label">Appearance</div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Dark Mode</div>
              <div class="setting-sub">Premium dark music UI</div>
            </div>
            <ion-toggle
              [checked]="isDark"
              (ionChange)="toggleTheme($event)"
              color="primary"
            ></ion-toggle>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">Audio</div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Low Latency Mode</div>
              <div class="setting-sub">Faster pitch response (uses more battery)</div>
            </div>
            <ion-toggle [(ngModel)]="lowLatency" color="primary"></ion-toggle>
          </div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Use Audio Samples</div>
              <div class="setting-sub">High quality tanpura samples (loads on Wi-Fi)</div>
            </div>
            <ion-toggle [(ngModel)]="useSamples" color="primary"></ion-toggle>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">Pitch Detection</div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Detection Sensitivity</div>
              <div class="setting-sub">High sensitivity may pick up background noise</div>
            </div>
            <select class="form-select-sm" [(ngModel)]="sensitivity">
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Show Hz Frequency</div>
            </div>
            <ion-toggle [(ngModel)]="showHz" color="primary"></ion-toggle>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">Notifications</div>
          <div class="settings-row sruti-card">
            <div class="setting-info">
              <div class="setting-name">Daily Riyaz Reminder</div>
              <div class="setting-sub">Get reminded to practice every day</div>
            </div>
            <ion-toggle [(ngModel)]="dailyReminder" color="primary"></ion-toggle>
          </div>
        </div>

        <div class="settings-group">
          <div class="group-label">App Version</div>
          <div class="settings-row sruti-card version-row">
            <span>Sruti v1.0.0</span>
            <span class="version-badge">Production</span>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styles: [`
    .settings-page { padding: 16px; padding-bottom: calc(80px + env(safe-area-inset-bottom)); display: flex; flex-direction: column; gap: 20px; }
    .settings-group { display: flex; flex-direction: column; gap: 8px; }
    .group-label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--sruti-text-secondary); }
    .settings-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px !important; }
    .setting-info { flex: 1; margin-right: 16px; }
    .setting-name { font-size: 15px; font-weight: 600; }
    .setting-sub  { font-size: 12px; color: var(--sruti-text-secondary); margin-top: 2px; }
    .form-select-sm { background: var(--sruti-bg-input); border: 1px solid var(--sruti-border); border-radius: 8px; padding: 6px 10px; color: var(--sruti-text-primary); font-size: 13px; outline: none; }
    .version-row { font-size: 14px; color: var(--sruti-text-secondary); }
    .version-badge { font-size: 12px; background: rgba(0,230,118,0.12); color: #00e676; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
  `]
})
export class SettingsPage {
  isDark = true;
  lowLatency = false;
  useSamples = true;
  sensitivity = 'medium';
  showHz = true;
  dailyReminder = true;

  constructor(private themeService: ThemeService) {
    this.isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  }

  toggleTheme(event: Event): void {
    this.isDark = (event as CustomEvent).detail.checked;
    this.themeService.setTheme(this.isDark ? 'dark' : 'light');
  }
}
