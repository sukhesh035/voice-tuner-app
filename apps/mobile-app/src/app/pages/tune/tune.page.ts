import { Component, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { lockClosedOutline, chevronForwardOutline } from 'ionicons/icons';
import { SubscriptionService } from '@voice-tuner/subscription';

interface TunerCard {
  title: string;
  description: string;
  route: string;
}

@Component({
  selector: 'app-tune',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonHeader, IonTitle, IonToolbar, IonIcon],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>Tune</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="tune-content">
      <div class="tune-hero">
        <h2>Instrument Tuners</h2>
        <p>Tune your instruments relative to your Sa</p>
      </div>

      <div class="tuner-cards">
        @for (card of tunerCards; track card.route) {
          <div class="tuner-card" (click)="navigate(card.route)">
            <div class="card-body">
              <div class="card-text">
                <h3>{{ card.title }}</h3>
                <p>{{ card.description }}</p>
              </div>
              <div class="card-action">
                @if (!isPremium()) {
                  <ion-icon name="lock-closed-outline" class="lock-icon"></ion-icon>
                } @else {
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                }
              </div>
            </div>
            @if (!isPremium()) {
              <span class="premium-badge">Premium</span>
            }
          </div>
        }
      </div>

      @if (!isPremium()) {
        <p class="upgrade-hint">Subscribe to unlock all tuners</p>
      }
    </ion-content>
  `,
  styles: [`
    .tune-hero { padding: 24px 16px 8px; }
    .tune-hero h2 { font-size: 1.4rem; font-weight: 700; margin: 0 0 4px; }
    .tuner-cards { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .tuner-card { background: var(--swara-surface); border-radius: 16px; padding: 20px; position: relative; cursor: pointer; }
    .card-body { display: flex; align-items: center; justify-content: space-between; }
    .card-text h3 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 600; }
    .card-text p { margin: 0; font-size: 0.85rem; color: var(--ion-color-medium); }
    .lock-icon { color: var(--swara-accent); font-size: 1.4rem; }
    .premium-badge { position: absolute; top: 12px; right: 12px; background: var(--swara-accent); color: #fff; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    .upgrade-hint { text-align: center; color: var(--ion-color-medium); font-size: 0.85rem; padding: 8px 16px 24px; }
  `]
})
export class TunePage {
  readonly isPremium = this.subscriptionService.isPremium;

  readonly tunerCards: TunerCard[] = [
    {
      title: 'Guitar Tuner',
      route: '/tune-guitar',
      description: 'Sa-Pa-Sa-Ma-Sa-Pa tuning relative to your key',
    },
    {
      title: 'Violin Tuner',
      route: '/tune-violin',
      description: 'Pa-Sa-Pa-Sa tuning for Indian classical violin',
    },
  ];

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly router: Router,
  ) {
    addIcons({ lockClosedOutline, chevronForwardOutline });
  }

  navigate(route: string): void {
    this.router.navigate([route]);
  }
}
