import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButton,
  IonIcon, IonSpinner, ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { SubscriptionService } from '@voice-tuner/subscription';
import { AnalyticsService } from '../../../core/services/analytics.service';
import type { PurchasesOfferings, PurchasesPackage } from '@revenuecat/purchases-capacitor';

type LoadState = 'loading' | 'ready' | 'error';

@Component({
  selector: 'app-paywall-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonButton, IonIcon, IonSpinner
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-button slot="end" fill="clear" (click)="dismiss()">
          <ion-icon name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="paywall-content">

      <div class="paywall-hero">
        <h1>Unlock Swara Premium</h1>
        <p>Tune your instruments the Indian classical way</p>
      </div>

      <ul class="feature-list">
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          Indian-scale Guitar Tuner (Sa-relative)
        </li>
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          Indian-scale Violin Tuner (Pa-Sa-Pa-Sa)
        </li>
        <li>
          <ion-icon name="checkmark-circle-outline"></ion-icon>
          All future premium features
        </li>
      </ul>

      @if (loadState() === 'loading') {
        <div class="loading-state">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      }

      @if (loadState() === 'error') {
        <div class="error-state">
          <p>Could not load pricing. Check your connection.</p>
          <ion-button fill="outline" (click)="loadOfferings()">Try Again</ion-button>
        </div>
      }

      @if (loadState() === 'ready') {
        <div class="pricing-cards">
          @for (pkg of packages(); track pkg.identifier) {
            <div
              class="pricing-card"
              [class.selected]="selectedPackage()?.identifier === pkg.identifier"
              (click)="selectPackage(pkg)"
            >
              @if (pkg.packageType === 'ANNUAL') {
                <span class="savings-badge">Save 37%</span>
              }
              <div class="pkg-title">{{ pkg.product.title }}</div>
              <div class="pkg-price">
                @if (pkg.product.introPrice) {
                  <span class="trial-label">3 days free, then</span>
                }
                {{ pkg.product.priceString }}
                <span class="pkg-period">/ {{ pkg.packageType === 'MONTHLY' ? 'month' : 'year' }}</span>
              </div>
            </div>
          }
        </div>

        <ion-button
          expand="block"
          class="subscribe-btn"
          [disabled]="subscribing()"
          (click)="subscribe()"
        >
          @if (subscribing()) {
            <ion-spinner name="crescent" slot="start"></ion-spinner>
            Processing...
          } @else if (selectedPackage()?.product?.introPrice) {
            Start 3-Day Free Trial
          } @else {
            Subscribe Now
          }
        </ion-button>
      }

      <div class="paywall-footer">
        <button class="restore-btn" (click)="restore()">Restore Purchases</button>
        <p class="legal">Cancel anytime. Managed by Apple / Google.</p>
      </div>

    </ion-content>
  `,
  styles: [`
    .paywall-hero { text-align: center; padding: 24px 16px 8px; }
    .paywall-hero h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 8px; }
    .feature-list { list-style: none; padding: 0 24px; margin: 16px 0; }
    .feature-list li { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
    .pricing-cards { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
    .pricing-card { border: 2px solid var(--ion-color-medium); border-radius: 12px; padding: 16px; position: relative; cursor: pointer; }
    .pricing-card.selected { border-color: var(--swara-primary); }
    .savings-badge { position: absolute; top: -10px; right: 12px; background: var(--swara-secondary); color: #000; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 99px; }
    .pkg-title { font-weight: 600; margin-bottom: 4px; }
    .pkg-price { font-size: 1.2rem; font-weight: 700; }
    .pkg-period { font-size: 0.85rem; font-weight: 400; color: var(--ion-color-medium); }
    .trial-label { display: block; font-size: 0.75rem; font-weight: 400; color: var(--swara-secondary); }
    .subscribe-btn { margin: 8px 16px; }
    .loading-state, .error-state { display: flex; flex-direction: column; align-items: center; padding: 32px; gap: 16px; }
    .paywall-footer { text-align: center; padding: 16px; }
    .restore-btn { background: none; border: none; color: var(--ion-color-medium); font-size: 0.85rem; cursor: pointer; text-decoration: underline; }
    .legal { font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 8px; }
  `]
})
export class PaywallModalComponent implements OnInit {
  readonly loadState = signal<LoadState>('loading');
  readonly packages = signal<PurchasesPackage[]>([]);
  readonly selectedPackage = signal<PurchasesPackage | null>(null);
  readonly subscribing = signal<boolean>(false);

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly subscriptionService: SubscriptionService,
    private readonly analytics: AnalyticsService,
  ) {
    addIcons({ closeOutline, checkmarkCircleOutline });
  }

  async ngOnInit(): Promise<void> {
    await this.loadOfferings();
  }

  async loadOfferings(): Promise<void> {
    this.loadState.set('loading');
    const offerings = await this.subscriptionService.getOfferings();
    if (!offerings?.current) {
      this.loadState.set('error');
      return;
    }
    const pkgs = offerings.current.availablePackages;
    this.packages.set(pkgs);
    const annual = pkgs.find(p => p.packageType === 'ANNUAL');
    this.selectedPackage.set(annual ?? pkgs[0] ?? null);
    this.loadState.set('ready');
  }

  selectPackage(pkg: PurchasesPackage): void {
    this.selectedPackage.set(pkg);
  }

  async subscribe(): Promise<void> {
    const pkg = this.selectedPackage();
    if (!pkg) return;

    this.analytics.logPurchaseInitiated(
      pkg.product.identifier,
      pkg.product.price,
      pkg.product.currencyCode
    );
    this.subscribing.set(true);

    try {
      await this.subscriptionService.purchase(pkg);
      this.analytics.logPurchaseCompleted(
        pkg.product.identifier,
        pkg.product.price,
        pkg.product.currencyCode
      );
      await this.modalCtrl.dismiss(null, 'purchased');
    } catch (err: unknown) {
      const cancelled = (err as { userCancelled?: boolean })?.userCancelled;
      if (!cancelled) {
        this.analytics.logPurchaseFailed(
          pkg.product.identifier,
          String(err)
        );
      }
    } finally {
      this.subscribing.set(false);
    }
  }

  async restore(): Promise<void> {
    await this.subscriptionService.restorePurchases();
    if (this.subscriptionService.isPremium()) {
      await this.modalCtrl.dismiss(null, 'purchased');
    }
  }

  dismiss(): void {
    this.modalCtrl.dismiss(null, 'cancelled');
  }
}
