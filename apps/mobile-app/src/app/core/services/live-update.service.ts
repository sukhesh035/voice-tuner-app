import { Injectable, NgZone, isDevMode } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { CapacitorUpdater, BundleInfo } from '@capgo/capacitor-updater';
import { environment } from '../../../environments/environment';

/**
 * Self-hosted manifest that lives on CloudFront at:
 *   <updatesCdnUrl>/manifest.json
 *
 * The publish-update.mjs script writes this file every time a new
 * bundle is uploaded to S3.
 */
interface UpdateManifest {
  /** Semver-ish version string, e.g. "1.2.0" */
  version: string;
  /** Absolute URL to the zip bundle on CloudFront */
  url: string;
}

@Injectable({ providedIn: 'root' })
export class LiveUpdateService {
  /** Whether an update was downloaded and is waiting to be applied. */
  private pendingBundle: BundleInfo | null = null;

  constructor(private zone: NgZone) {}

  /**
   * Call once from AppComponent.ngOnInit().
   *
   * Flow:
   * 1. Notify the plugin that the current bundle booted successfully
   *    (prevents automatic rollback).
   * 2. Fetch the manifest from CloudFront.
   * 3. If a newer version exists, download the zip in the background.
   * 4. When the user next backgrounds/foregrounds the app, apply the update.
   */
  async initialize(): Promise<void> {
    if (isDevMode()) console.log('[LiveUpdate] initialize() called');

    // Live updates only make sense on a real device with a native shell.
    if (!Capacitor.isNativePlatform()) {
      if (isDevMode()) console.log('[LiveUpdate] not a native platform — skipping');
      return;
    }

    // Let the plugin know the current bundle is good — skip this and the
    // plugin will roll back to the built-in bundle after a timeout.
    await CapacitorUpdater.notifyAppReady();
    if (isDevMode()) console.log('[LiveUpdate] notifyAppReady() done');

    // Check for an update in the background (non-blocking).
    this.checkForUpdate().catch((err) =>
      console.warn('[LiveUpdate] update check failed:', err),
    );
    // Apply the pending bundle when the user returns to the app.
    App.addListener('appStateChange', ({ isActive }) => {
      if (isActive && this.pendingBundle) {
        this.applyPendingUpdate();
      }
    });
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private async checkForUpdate(): Promise<void> {
    const manifestUrl = (environment as any).liveUpdate?.manifestUrl;
    if (isDevMode()) console.log('[LiveUpdate] manifestUrl:', manifestUrl ?? '(not configured)');
    if (!manifestUrl) {
      return; // No manifest URL configured — nothing to do.
    }

    // Fetch the manifest from CloudFront (cache-busted by the CDN config).
    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) {
      console.warn(`[LiveUpdate] manifest fetch returned ${res.status}`);
      return;
    }

    const manifest: UpdateManifest = await res.json();
    const current = await CapacitorUpdater.current();
    if (isDevMode()) console.log(
      `[LiveUpdate] current: ${current.bundle.version}, remote: ${manifest.version}`,
    );

    // Compare versions — skip download if already running this version.
    if (current.bundle.version === manifest.version) {
      if (isDevMode()) console.log('[LiveUpdate] already up-to-date');
      return;
    }

    if (isDevMode()) console.log(
      `[LiveUpdate] new version available: ${manifest.version} (current: ${current.bundle.version})`,
    );

    // Download the zip in the background. The plugin stores it on-device.
    const bundle = await CapacitorUpdater.download({
      url: manifest.url,
      version: manifest.version,
    });

    this.pendingBundle = bundle;
    if (isDevMode()) console.log(`[LiveUpdate] bundle ${bundle.version} downloaded, waiting to apply`);
  }

  private async applyPendingUpdate(): Promise<void> {
    if (!this.pendingBundle) {
      return;
    }

    const bundle = this.pendingBundle;
    this.pendingBundle = null;

    if (isDevMode()) console.log(`[LiveUpdate] applying bundle ${bundle.version}`);
    // set() swaps the web root to the downloaded bundle and reloads.
    await CapacitorUpdater.set(bundle);
  }
}
