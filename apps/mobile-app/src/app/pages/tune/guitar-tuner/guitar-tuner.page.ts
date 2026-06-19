import { Component, OnDestroy, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButton, IonIcon, IonBackButton, IonButtons,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { micOutline, micOffOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { AudioEngineService } from '@voice-tuner/audio-engine';
import { PitchDetectionService } from '@voice-tuner/pitch-detection';
import { SubscriptionService } from '@voice-tuner/subscription';
import { PaywallModalComponent } from '../../../shared/components/paywall-modal/paywall-modal.component';

interface GuitarString {
  label: string;
  indianName: string;
  semitonesFromSa: number;
}

const GUITAR_STRINGS: GuitarString[] = [
  { label: 'String 6', indianName: 'Sa',  semitonesFromSa: -24 },
  { label: 'String 5', indianName: 'Pa',  semitonesFromSa: -17 },
  { label: 'String 4', indianName: 'Sa',  semitonesFromSa: -12 },
  { label: 'String 3', indianName: 'Ma',  semitonesFromSa:  -5 },
  { label: 'String 2', indianName: 'Sa',  semitonesFromSa:   0 },
  { label: 'String 1', indianName: 'Pa',  semitonesFromSa:   7 },
];

const SA_FREQUENCY_DEFAULT = 261.63; // C4

@Component({
  selector: 'app-guitar-tuner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButton, IonIcon, IonBackButton, IonButtons,
  ],
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/tune"></ion-back-button>
        </ion-buttons>
        <ion-title>Guitar Tuner</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="tuner-content">

      <div class="sa-display">Sa = {{ saNoteName() }}</div>

      <div class="string-selector">
        @for (str of strings; track str.label; let i = $index) {
          <button
            class="string-btn"
            [class.active]="activeStringIndex() === i"
            (click)="selectString(i)"
          >
            <span class="string-indian">{{ str.indianName }}</span>
            <span class="string-label">{{ str.label }}</span>
          </button>
        }
      </div>

      <div class="gauge-container">
        <div class="gauge-track">
          <div
            class="gauge-needle"
            [style.left.%]="needlePosition()"
            [class.in-tune]="isInTune()"
          ></div>
        </div>
        <div class="gauge-labels">
          <span>-50¢</span>
          <span>0</span>
          <span>+50¢</span>
        </div>
        <div class="cents-display" [class.in-tune]="isInTune()">{{ centsDisplay() }}</div>
        <div class="note-display">{{ detectedNote() }}</div>
      </div>

      <ion-button expand="block" class="mic-btn" (click)="toggleMic()">
        <ion-icon [name]="micActive() ? 'mic-outline' : 'mic-off-outline'" slot="start"></ion-icon>
        {{ micActive() ? 'Listening...' : 'Start Tuner' }}
      </ion-button>

    </ion-content>
  `,
  styles: [`
    .sa-display { text-align: center; padding: 12px; font-size: 0.9rem; color: var(--ion-color-medium); }
    .string-selector { display: flex; gap: 8px; padding: 12px 16px; overflow-x: auto; }
    .string-btn { flex-shrink: 0; background: var(--swara-surface); border: 2px solid transparent; border-radius: 10px; padding: 10px 14px; text-align: center; cursor: pointer; color: var(--ion-text-color); }
    .string-btn.active { border-color: var(--swara-primary); }
    .string-indian { display: block; font-weight: 700; font-size: 1rem; }
    .string-label { display: block; font-size: 0.7rem; color: var(--ion-color-medium); }
    .gauge-container { padding: 32px 24px 16px; }
    .gauge-track { height: 8px; background: linear-gradient(to right, var(--ion-color-danger), var(--ion-color-warning), var(--ion-color-success), var(--ion-color-warning), var(--ion-color-danger)); border-radius: 4px; position: relative; }
    .gauge-needle { position: absolute; top: -8px; width: 4px; height: 24px; background: white; border-radius: 2px; transform: translateX(-50%); transition: left 0.1s ease; }
    .gauge-needle.in-tune { background: var(--ion-color-success); box-shadow: 0 0 8px var(--ion-color-success); }
    .gauge-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--ion-color-medium); margin-top: 6px; }
    .cents-display { text-align: center; font-size: 2rem; font-weight: 700; margin-top: 24px; }
    .cents-display.in-tune { color: var(--ion-color-success); }
    .note-display { text-align: center; font-size: 0.9rem; color: var(--ion-color-medium); margin-top: 4px; }
    .mic-btn { margin: 24px 16px; }
  `]
})
export class GuitarTunerPage implements OnDestroy {
  readonly strings = GUITAR_STRINGS;
  readonly activeStringIndex = signal<number>(4); // String 2 = Sa
  readonly micActive = signal<boolean>(false);
  readonly centsDisplay = signal<string>('—');
  readonly needlePosition = signal<number>(50);
  readonly isInTune = signal<boolean>(false);
  readonly detectedNote = signal<string>('');
  readonly saNoteName = signal<string>('C');

  private pitchSub: Subscription | null = null;
  private saFrequency = SA_FREQUENCY_DEFAULT;

  constructor(
    private readonly audioEngine: AudioEngineService,
    private readonly pitchDetection: PitchDetectionService,
    private readonly subscriptionService: SubscriptionService,
    private readonly modalCtrl: ModalController,
  ) {
    addIcons({ micOutline, micOffOutline });
  }

  async ionViewWillEnter(): Promise<void> {
    if (!this.subscriptionService.isPremium()) {
      const modal = await this.modalCtrl.create({
        component: PaywallModalComponent,
        cssClass: 'paywall-modal',
      });
      await modal.present();
      const { role } = await modal.onWillDismiss();
      if (role === 'purchased') {
        await this.startTuner();
      }
      return;
    }
    await this.startTuner();
  }

  ionViewWillLeave(): void {
    this.stopTuner();
  }

  ngOnDestroy(): void {
    this.stopTuner();
  }

  selectString(index: number): void {
    this.activeStringIndex.set(index);
    this.centsDisplay.set('—');
    this.needlePosition.set(50);
    this.isInTune.set(false);
  }

  async toggleMic(): Promise<void> {
    if (this.micActive()) {
      this.stopTuner();
    } else {
      await this.startTuner();
    }
  }

  private async startTuner(): Promise<void> {
    await this.audioEngine.initialize();
    await this.audioEngine.enableMicrophone();
    this.micActive.set(true);

    this.pitchSub = this.pitchDetection.smoothPitch$.subscribe(result => {
      if (!result) return;
      const target = this.targetFrequency();
      const cents = 1200 * Math.log2(result.frequency / target);
      const clamped = Math.max(-50, Math.min(50, cents));
      const position = ((clamped + 50) / 100) * 100;

      this.centsDisplay.set(cents >= 0 ? `+${cents.toFixed(0)}¢` : `${cents.toFixed(0)}¢`);
      this.needlePosition.set(position);
      this.isInTune.set(Math.abs(cents) <= 5);
      this.detectedNote.set(`${result.note}${result.octave} — ${result.frequency.toFixed(1)} Hz`);
    });
  }

  private stopTuner(): void {
    this.pitchSub?.unsubscribe();
    this.pitchSub = null;
    this.audioEngine.disableMicrophone();
    this.micActive.set(false);
  }

  private targetFrequency(): number {
    const semitones = GUITAR_STRINGS[this.activeStringIndex()].semitonesFromSa;
    return this.saFrequency * Math.pow(2, semitones / 12);
  }
}
