import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, home,
  musicalNoteOutline, musicalNote,
  micOutline, mic,
  barbellOutline, barbell,
  trendingUpOutline, trendingUp,
  settingsOutline, settings,
  personOutline, person
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, RouterLink, RouterLinkActive],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="sruti-tab-bar">
        <ion-tab-button tab="home" [routerLink]="['/home']">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="tanpura" [routerLink]="['/tanpura']">
          <ion-icon name="musical-note-outline"></ion-icon>
          <ion-label>Tanpura</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sing" [routerLink]="['/sing']" class="tab-center">
          <ion-icon name="mic-outline"></ion-icon>
          <ion-label>Sing</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="practice" [routerLink]="['/practice']">
          <ion-icon name="barbell-outline"></ion-icon>
          <ion-label>Practice</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="progress" [routerLink]="['/progress']">
          <ion-icon name="trending-up-outline"></ion-icon>
          <ion-label>Progress</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
  constructor() {
    addIcons({
      homeOutline, home,
      musicalNoteOutline, musicalNote,
      micOutline, mic,
      barbellOutline, barbell,
      trendingUpOutline, trendingUp,
      settingsOutline, settings,
      personOutline, person
    });
  }
}
