import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  musicalNote, mic, flame, school, trendingUp, sparkles
} from 'ionicons/icons';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon
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
          <div class="hero-greeting">Good Evening, रियाज़ करें</div>
          <div class="hero-title">
            Your Daily<br />
            <span class="hero-highlight">Riyaz Companion</span>
          </div>
          <div class="sruti-streak-badge">
            <span class="streak-icon">🔥</span>
            <span>7 Day Streak</span>
          </div>
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

        <!-- Today's Progress -->
        <div class="today-section">
          <div class="section-label">Today's Practice</div>
          <div class="sruti-card today-card">
            <div class="today-stats">
              <div class="today-stat">
                <div class="today-stat__value">0</div>
                <div class="today-stat__label">Minutes</div>
              </div>
              <div class="today-stat">
                <div class="today-stat__value">–</div>
                <div class="today-stat__label">Accuracy</div>
              </div>
              <div class="today-stat">
                <div class="today-stat__value">0</div>
                <div class="today-stat__label">Sessions</div>
              </div>
            </div>
            <div class="today-cta">
              <a [routerLink]="['/practice']" class="sruti-btn sruti-btn--primary">
                Start Riyaz
              </a>
            </div>
          </div>
        </div>

        <!-- Raga of the Day -->
        <div class="raga-day-section">
          <div class="section-label">Raga of the Day</div>
          <div class="sruti-card raga-day-card">
            <div class="raga-day-accent"></div>
            <div class="raga-day-content">
              <div class="raga-day-name">Yaman</div>
              <div class="raga-day-hindi">यमन</div>
              <div class="raga-day-time">🌆 Evening Raga</div>
              <div class="raga-day-desc">
                The most popular evening raga. Begin with Sa Pa Ni Sa in Alaap.
              </div>
            </div>
          </div>
        </div>

        <!-- Weekly Overview -->
        <div class="weekly-section">
          <div class="section-label">This Week</div>
          <div class="weekly-bars">
            <div *ngFor="let day of weekDays; let i = index" class="day-bar">
              <div class="day-bar__fill" [style.height]="weekData[i] + '%'">
                <div class="day-bar__glow"></div>
              </div>
              <div class="day-bar__label">{{ day }}</div>
            </div>
          </div>
        </div>

      </div>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage {
  readonly weekDays  = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly weekData  = [65, 80, 40, 90, 55, 70, 0];

  constructor() {
    addIcons({ musicalNote, mic, flame, school, trendingUp, sparkles });
  }
}
