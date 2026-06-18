import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonTabs, IonTabBar, IonTabButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  homeOutline, home,
  micOutline, mic,
  barbellOutline, barbell,
  optionsOutline, options,
  personOutline, person
} from 'ionicons/icons';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, RouterLink],
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="swara-tab-bar">
        <ion-tab-button tab="home" [routerLink]="['/home']">
          <ion-icon name="home-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="sing" [routerLink]="['/sing']" class="tab-center">
          <ion-icon name="mic-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="practice" [routerLink]="['/practice']">
          <ion-icon name="barbell-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="tune" [routerLink]="['/tune']">
          <ion-icon name="options-outline"></ion-icon>
        </ion-tab-button>
        <ion-tab-button tab="profile" [routerLink]="['/profile']">
          <ion-icon name="person-outline"></ion-icon>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styleUrls: ['./tabs.component.scss']
})
export class TabsComponent {
  private readonly _icons = (() => addIcons({
    homeOutline, home,
    micOutline, mic,
    barbellOutline, barbell,
    optionsOutline, options,
    personOutline, person
  }))();
}
