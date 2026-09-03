import { Injectable, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ApiService } from './api.service';

const INSTALL_ID_KEY = 'swara_install_id';

/** RFC-4122 v4 shaped id for webviews without crypto.randomUUID. */
function generateInstallId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Anonymous usage pings — install-id + platform only, no Firebase, no auth.
 * Lets the backend count DAU/WAU/MAU for users who never sign up.
 */
@Injectable({ providedIn: 'root' })
export class UsageService {
  private readonly api = inject(ApiService);

  /** True once an open ping has fired this foreground session. */
  private reportedThisSession = false;

  /** Stable anonymous id for this install, generated once and persisted in localStorage. */
  get installId(): string {
    let id = localStorage.getItem(INSTALL_ID_KEY);
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : generateInstallId();
      try {
        localStorage.setItem(INSTALL_ID_KEY, id);
      } catch {
        // Storage unavailable — id still holds for the rest of this session.
      }
    }
    return id;
  }

  /** Fire one open ping per foreground session. Cheap, non-blocking, silent on error. */
  reportOpenIfNeeded(): void {
    if (this.reportedThisSession) return;
    this.reportedThisSession = true;
    this.api.reportAppOpen({ installId: this.installId, platform: Capacitor.getPlatform() })
      .then(() => {})
      .catch((err) => console.warn('[Usage] reportAppOpen failed:', err));
  }

  /** Call when the app leaves the foreground so the next foreground entry pings again. */
  resetSession(): void {
    this.reportedThisSession = false;
  }
}
