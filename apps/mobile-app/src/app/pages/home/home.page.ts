import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AsyncPipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipses, mic, sparkles
} from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { MELAKARTA_LIST } from '@voice-tuner/training-engine';
import { AnalyticsService } from '../../core/services/analytics.service';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent, IonIcon,
    AsyncPipe
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Swara AI</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="home-page">

        <!-- Greeting -->
        <div class="greeting-section">
          <div class="greeting">{{ greeting }}</div>
          @if (authService.user$ | async; as user) {
            <div class="user-name">{{ user.name }}</div>
          }
        </div>

        <!-- Quick Actions -->
        <div class="section-label">Quick Start</div>
        <div class="action-grid">
          <a class="action-card" [routerLink]="['/metronome']" (click)="trackTap('metronome')">
            <div class="action-card__icon metronome-icon">
              <svg width="28" height="28" viewBox="0 0 512 512" fill="none" stroke="currentColor" stroke-width="28">
                <rect x="136" y="160" width="240" height="304" rx="20" ry="20"/>
                <path d="M160 160l40-96h112l40 96"/>
                <path d="M256 64v80"/>
                <line x1="256" y1="400" x2="256" y2="280"/>
                <circle cx="256" cy="400" r="24"/>
              </svg>
            </div>
            <div class="action-card__text">Metronome</div>
          </a>
          <a class="action-card" [routerLink]="['/sing']" (click)="trackTap('sing')">
            <div class="action-card__icon sing-icon">
              <ion-icon name="mic"></ion-icon>
            </div>
            <div class="action-card__text">Sing</div>
          </a>
          <a class="action-card" [routerLink]="['/practice']" (click)="trackTap('practice')">
            <div class="action-card__icon practice-icon">
              <ion-icon name="sparkles"></ion-icon>
            </div>
            <div class="action-card__text">Practice</div>
          </a>
        </div>

        <!-- Raga of the Day -->
        <div class="section-label">Raga of the Day</div>
        <a class="raga-card" [routerLink]="['/practice']" [queryParams]="{raga: ragaOfDay.name}" (click)="trackTap('raga_of_day')">
          <div class="raga-accent"></div>
          <div class="raga-body">
            <div class="raga-name">{{ ragaOfDay.name }}</div>
            <div class="raga-hindi">{{ ragaOfDay.hindi }}</div>
            <div class="raga-time">{{ ragaOfDay.time }}</div>
            <div class="raga-desc">{{ ragaOfDay.desc }}</div>
          </div>
        </a>

        <!-- Give Feedback -->
        <a
          class="learn-card"
          [routerLink]="['/feedback']"
          (click)="trackTap('feedback')"
        >
          <div class="learn-card__icon learn-card__icon--feedback">
            <ion-icon name="chatbubble-ellipses"></ion-icon>
          </div>
          <div class="learn-card__body">
            <div class="learn-card__title">Give Feedback</div>
            <div class="learn-card__sub">Share your thoughts</div>
          </div>
          <div class="learn-card__arrow">&#8250;</div>
        </a>

      </div>
    </ion-content>
  `,
  styleUrls: ['./home.page.scss']
})
export class HomePage {
  readonly ragaOfDay = (() => {
    const EPOCH = Date.UTC(2024, 0, 1);
    const dayIndex = Math.floor((Date.now() - EPOCH) / 86_400_000);
    const raga = MELAKARTA_LIST[((dayIndex % MELAKARTA_LIST.length) + MELAKARTA_LIST.length) % MELAKARTA_LIST.length];
    return { name: raga.englishName, hindi: raga.name, time: raga.time, desc: raga.description };
  })();

  readonly authService = inject(AuthService);
  readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ chatbubbleEllipses, mic, sparkles }))();

  get greeting(): string {
    const h = new Date().getHours();
    if (h < 5)  return 'Good Night';
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    if (h < 21) return 'Good Evening';
    return 'Good Night';
  }

  trackTap(target: string): void {
    // Standard GA4 select_content + a CTA tap for funnel attribution
    this.analytics.logSelectContent({ content_type: 'home_quick_action', content_id: target });
    this.analytics.logCtaTap(`home_${target}`);
  }
}