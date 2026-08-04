import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, arrowForwardOutline, checkmarkCircleOutline, speedometerOutline, trendingUpOutline, libraryOutline, musicalNotesOutline } from 'ionicons/icons';
import { AnalyticsService } from '../../../core/services/analytics.service';
import { FeatureSlide } from '../../../core/services/feature-tour.service';

@Component({
  selector: 'app-feature-tour',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButton, IonIcon],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-title>What's New</ion-title>
        <ion-button slot="end" fill="clear" (click)="skip()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="tour-page">
        <div class="tour-slide">
          <div class="tour-icon">
            <ion-icon [name]="currentSlide()?.icon"></ion-icon>
          </div>
          <h2 class="tour-title">{{ currentSlide()?.title }}</h2>
          <p class="tour-desc">{{ currentSlide()?.description }}</p>
        </div>

        <div class="tour-progress">
          <div class="progress-dots">
            @for (s of slides; track $index) {
            <span class="progress-dot" [class.active]="$index === step()"></span>
            }
          </div>
        </div>

        <div class="tour-controls">
          @if (currentSlide()?.target) {
          <ion-button fill="outline" (click)="openTarget()">Try it</ion-button>
          }
          @if (step() < slides.length - 1) {
          <ion-button expand="block" class="primary" (click)="next()">
            Next
            <ion-icon name="arrow-forward-outline" slot="end"></ion-icon>
          </ion-button>
          } @else {
          <ion-button expand="block" class="primary" (click)="done()">
            <ion-icon name="checkmark-circle-outline" slot="start"></ion-icon>
            Done
          </ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styleUrls: ['./feature-tour.component.scss']
})
export class FeatureTourComponent {
  slides: FeatureSlide[] = [];
  releaseKey = '';

  readonly step = signal<number>(0);
  readonly currentSlide = computed<FeatureSlide | null>(() => this.slides[this.step()] ?? null);

  private readonly router = inject(Router);
  private readonly modalCtrl = inject(ModalController);
  private readonly analytics = inject(AnalyticsService);
  private readonly _icons = (() => addIcons({ closeOutline, arrowForwardOutline, checkmarkCircleOutline, speedometerOutline, trendingUpOutline, libraryOutline, musicalNotesOutline }))();

  next(): void {
    const s = this.step() + 1;
    this.step.set(s);
    this.analytics.logEvent('feature_tour_step', { release_key: this.releaseKey, step: s, total_steps: this.slides.length });
  }

  skip(): void {
    this.analytics.logEvent('feature_tour_skipped', { release_key: this.releaseKey });
    this.modalCtrl.dismiss(null, 'skipped');
  }

  done(): void {
    this.analytics.logEvent('feature_tour_completed', { release_key: this.releaseKey, total_steps: this.slides.length });
    this.modalCtrl.dismiss(null, 'completed');
  }

  openTarget(): void {
    const target = this.currentSlide()?.target;
    this.analytics.logEvent('feature_tour_open_target', { release_key: this.releaseKey, target: target ?? '' });
    this.modalCtrl.dismiss(null, 'target');
    if (target) this.router.navigate([target]);
  }
}