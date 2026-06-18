import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-guitar-tuner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Guitar Tuner</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content><!-- placeholder --></ion-content>
  `
})
export class GuitarTunerPage {}
