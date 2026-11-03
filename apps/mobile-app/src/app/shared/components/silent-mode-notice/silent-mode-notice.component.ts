import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { volumeMuteOutline } from 'ionicons/icons';
import { MuteService } from '../../../core/services/mute.service';

/**
 * Inline banner shown when the device is on silent, so users know why
 * they can't hear the metronome or tanpura sound.
 */
@Component({
  selector: 'app-silent-mode-notice',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonIcon],
  template: `
    @if (mute.isMuted()) {
      <div class="silent-notice" role="status">
        <ion-icon name="volume-mute-outline"></ion-icon>
        <span>Your phone is on silent — you won't hear the sound.</span>
      </div>
    }
  `,
  styles: [`
    .silent-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 10px 14px;
      border-radius: 10px;
      background: rgba(255, 193, 7, 0.12);
      border: 1px solid rgba(255, 193, 7, 0.35);
      color: #ffd54f;
      font-size: 13px;
      font-weight: 600;
      line-height: 1.3;
    }
    .silent-notice ion-icon {
      font-size: 18px;
      flex-shrink: 0;
    }
  `],
})
export class SilentModeNoticeComponent {
  readonly mute = inject(MuteService);

  constructor() {
    addIcons({ volumeMuteOutline });
    this.mute.start();
  }
}
