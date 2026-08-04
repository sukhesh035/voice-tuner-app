import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { App } from '@capacitor/app';
import { ModalController } from '@ionic/angular/standalone';
import { FeatureTourComponent } from '../../shared/components/feature-tour/feature-tour.component';
import { AnalyticsService } from './analytics.service';

export interface FeatureSlide {
  icon: string;
  title: string;
  description: string;
  target?: string;
}

const DEV_TOUR_KEY = 'dev-tour-1';

const INITIAL_SLIDES: FeatureSlide[] = [
  { icon: 'speedometer-outline', title: 'Metronome & Tanpura', description: 'Two tabs in one screen — keep time with the metronome while a tanpura drone plays underneath.', target: '/metronome' },
  { icon: 'trending-up-outline', title: 'Ear Training Levels', description: 'Choose your difficulty — from a simple Sa–Re–Ga up to the full 12-note octave.', target: '/practice' },
  { icon: 'library-outline', title: 'Janya Ragas', description: 'Browse Melakarta parent ragas and the janya ragas derived from them.', target: '/practice' },
  { icon: 'musical-notes-outline', title: 'Guided Note Singing', description: 'Pick a note on the Sing page and the app guides you up or down until you sing it perfectly.', target: '/sing' },
];

const TOUR_CONTENT: Record<string, FeatureSlide[]> = {
  '1.1.0': INITIAL_SLIDES,
  // Dev/web preview: makes the tour testable without a native device.
  [DEV_TOUR_KEY]: INITIAL_SLIDES,
};

@Injectable({ providedIn: 'root' })
export class FeatureTourService {
  private readonly analytics = inject(AnalyticsService);
  private lastSeenKey: string | null = null;

  constructor() {
    try {
      this.lastSeenKey = localStorage.getItem('swara-last-tour-key');
    } catch {
      this.lastSeenKey = null;
    }
  }

  async resolveCurrentKey(): Promise<string> {
    try {
      if (Capacitor.isNativePlatform()) {
        const cur = await CapacitorUpdater.current();
        if (cur?.bundle?.version) return cur.bundle.version;
      }
    } catch { /* fall through */ }
    try {
      if (Capacitor.isNativePlatform()) {
        const info = await App.getInfo();
        if (info?.version) return info.version;
      }
    } catch { /* fall through */ }
    return DEV_TOUR_KEY;
  }

  getSlides(key: string): FeatureSlide[] {
    return TOUR_CONTENT[key] ?? [];
  }

  shouldShow(key: string): boolean {
    return key !== this.lastSeenKey && (TOUR_CONTENT[key]?.length ?? 0) > 0;
  }

  markShown(key: string): void {
    this.lastSeenKey = key;
    try { localStorage.setItem('swara-last-tour-key', key); } catch { }
  }

  async maybeShowTour(modalCtrl: ModalController): Promise<void> {
    const key = await this.resolveCurrentKey();
    const slides = this.getSlides(key);
    if (!this.shouldShow(key) || slides.length === 0) return;

    this.analytics.logEvent('feature_tour_started', { release_key: key, total_steps: slides.length });
    const modal = await modalCtrl.create({
      component: FeatureTourComponent,
      cssClass: 'feature-tour-modal',
      componentProps: { slides, releaseKey: key },
    });
    await modal.present();
    await modal.onWillDismiss();
    this.markShown(key);
  }
}