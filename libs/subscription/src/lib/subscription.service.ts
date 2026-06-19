import { Injectable, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import {
  Purchases,
  type CustomerInfo,
  type PurchasesOfferings,
  type PurchasesPackage,
  LOG_LEVEL,
} from '@revenuecat/purchases-capacitor';

@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private static readonly PREMIUM_ENTITLEMENT_ID = 'premium';

  private readonly _isPremium = signal<boolean>(false);
  private readonly _initialized = signal<boolean>(false);
  private _listenerCallbackId: string | null = null;

  /** Synchronous signal read — safe in templates and guards. */
  readonly isPremium = this._isPremium.asReadonly();
  readonly initialized = this._initialized.asReadonly();

  /** Observable adapter for reactive pipelines. */
  readonly isPremium$: Observable<boolean> = toObservable(this._isPremium);

  /**
   * Call once at app boot (APP_INITIALIZER) with the platform-specific
   * RevenueCat public API key.
   */
  async initialize(appleApiKey: string, googleApiKey: string): Promise<void> {
    if (this._initialized()) return;

    const apiKey = Capacitor.getPlatform() === 'ios' ? appleApiKey : googleApiKey;

    try {
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      await Purchases.configure({ apiKey });

      // Sync current entitlement state immediately
      const { customerInfo } = await Purchases.getCustomerInfo();
      this._updateFromCustomerInfo(customerInfo);

      // Listen for background changes (renewals, expirations, etc.)
      this._listenerCallbackId = await Purchases.addCustomerInfoUpdateListener((info: CustomerInfo) => {
        this._updateFromCustomerInfo(info);
      });
    } catch (err) {
      console.error('SubscriptionService: failed to initialize RevenueCat', err);
      // isPremium stays false — safe default (user is treated as non-premium)
    } finally {
      // Always mark initialized so the auth-sync guard doesn't block permanently
      this._initialized.set(true);
    }
  }

  /**
   * Associate RevenueCat purchases with the authenticated Cognito user.
   * Call after a successful sign-in.
   */
  async logIn(userId: string): Promise<void> {
    const result = await Purchases.logIn({ appUserID: userId });
    this._updateFromCustomerInfo(result.customerInfo);
  }

  /**
   * Disassociate the user — switches RevenueCat to an anonymous ID.
   * Call on sign-out.
   */
  async logOut(): Promise<void> {
    const { customerInfo } = await Purchases.logOut();
    this._updateFromCustomerInfo(customerInfo);
  }

  /**
   * Fetch the current RevenueCat offering (cached after first call).
   * Returns null if the network call fails.
   */
  async getOfferings(): Promise<PurchasesOfferings | null> {
    try {
      const offerings = await Purchases.getOfferings();
      return offerings;
    } catch {
      return null;
    }
  }

  /**
   * Trigger the native App Store / Google Play purchase sheet.
   * Throws PurchasesError on failure; throws with `userCancelled: true` if dismissed.
   */
  async purchase(rcPackage: PurchasesPackage): Promise<void> {
    const result = await Purchases.purchasePackage({ aPackage: rcPackage });
    this._updateFromCustomerInfo(result.customerInfo);
  }

  /**
   * Restore previous purchases (required by App Store guidelines).
   * Updates isPremium if an active entitlement is found.
   */
  async restorePurchases(): Promise<void> {
    const { customerInfo } = await Purchases.restorePurchases();
    this._updateFromCustomerInfo(customerInfo);
  }

  private _updateFromCustomerInfo(info: CustomerInfo): void {
    const hasPremium = info.entitlements.active[SubscriptionService.PREMIUM_ENTITLEMENT_ID] !== undefined;
    this._isPremium.set(hasPremium);
  }
}
