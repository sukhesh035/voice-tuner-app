import { Component, ChangeDetectionStrategy } from '@angular/core';
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

  get isDark(): boolean { return this.themeService.isDark; }

  constructor(public themeService: ThemeService) {
    addIcons({
      moonOutline, flashOutline, musicalNoteOutline, notificationsOutline,
      informationCircleOutline, documentTextOutline, shieldCheckmarkOutline,
      heartOutline, chevronForwardOutline
    });
  }

  toggleTheme(event: Event): void {
    const checked = (event as CustomEvent).detail.checked as boolean;
    this.themeService.setTheme(checked ? 'dark' : 'light');
  }
}
