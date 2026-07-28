import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, home,
  micOutline, mic,
  barbellOutline, barbell,
  trendingUpOutline, trendingUp,
  settingsOutline, settings,
  personOutline, person
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, RouterLink],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="swara-tab-bar">
        <ion-tab-button tab="home" [routerLink]="['/home']">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Home</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="metronome" [routerLink]="['/metronome']">
          <ion-icon name="metronome-outline"></ion-icon>
          <ion-label>Metronome</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="sing" [routerLink]="['/sing']" class="tab-center">
          <ion-icon name="mic-outline"></ion-icon>
          <ion-label>Sing</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="practice" [routerLink]="['/practice']">
          <ion-icon name="barbell-outline"></ion-icon>
          <ion-label>Practice</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="profile" [routerLink]="['/profile']">
          <ion-icon name="person-outline"></ion-icon>
          <ion-label>Profile</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
  // Register Ionicons at class field initialisation time — no constructor needed.
  private readonly _icons = (() => addIcons({
    homeOutline, home,
    micOutline, mic,
    barbellOutline, barbell,
    trendingUpOutline, trendingUp,
    settingsOutline, settings,
    personOutline, person,
    metronome: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect x='136' y='160' width='240' height='304' rx='20' ry='20' fill='none' stroke='currentColor' stroke-width='32' stroke-linejoin='round'/><path d='M160 160l40-96h112l40 96' fill='none' stroke='currentColor' stroke-width='32' stroke-linejoin='round'/><path d='M256 64v80' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><line x1='256' y1='400' x2='256' y2='280' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><circle cx='256' cy='400' r='24' fill='currentColor'/></svg>",
    metronomeOutline: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'><rect x='136' y='160' width='240' height='304' rx='20' ry='20' fill='none' stroke='currentColor' stroke-width='32' stroke-linejoin='round'/><path d='M160 160l40-96h112l40 96' fill='none' stroke='currentColor' stroke-width='32' stroke-linejoin='round'/><path d='M256 64v80' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><line x1='256' y1='400' x2='256' y2='280' fill='none' stroke='currentColor' stroke-width='32' stroke-linecap='round'/><circle cx='256' cy='400' r='24' fill='none' stroke='currentColor' stroke-width='32'/></svg>",
  }))();
}
