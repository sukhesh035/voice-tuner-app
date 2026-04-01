#!/usr/bin/env node
/**
 * patch-ios.mjs
 *
 * Patches the Capacitor-generated iOS files after every `cap sync`.
 * The ios/ folder is regenerated on each sync, so required plist keys that
 * are not natively supported by the Capacitor config schema must be injected
 * here rather than edited directly in the iOS folder.
 *
 * Currently patches Info.plist:
 *   - NSUserTrackingUsageDescription    (App Tracking Transparency — Guideline 5.1.2i)
 *   - NSCameraUsageDescription          (camera access for profile photo)
 *   - NSPhotoLibraryUsageDescription    (photo library access for profile photo)
 *   - ITSAppUsesNonExemptEncryption     (export compliance — only standard HTTPS/TLS used)
 *   - UIRequiredDeviceCapabilities      (replace stale armv7 with microphone)
 *
 * Usage:
 *   node scripts/patch-ios.mjs
 *
 * Must be run from the workspace root.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const infoPlistPath = resolve(__dirname, '../apps/mobile-app/ios/App/App/Info.plist');

let plist = readFileSync(infoPlistPath, 'utf8');

// ── Helper ────────────────────────────────────────────────────────────────────
function ensureKey(key, block, insertAfterRegex, label) {
  if (plist.includes(`<key>${key}</key>`)) {
    console.log(`✓ ${label} already present in Info.plist`);
  } else {
    plist = plist.replace(insertAfterRegex, `$1\n\t${block}`);
    console.log(`✓ Added ${label} to Info.plist`);
  }
}

// ── 1. NSUserTrackingUsageDescription ────────────────────────────────────────
// Required by Guideline 5.1.2(i) — ATT dialog will not appear without it.
ensureKey(
  'NSUserTrackingUsageDescription',
  `<key>NSUserTrackingUsageDescription</key>\n\t<string>We use analytics to understand how you use Swara AI so we can improve your practice experience.</string>`,
  /(<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]*<\/string>)/,
  'NSUserTrackingUsageDescription',
);

// ── 2. NSCameraUsageDescription ───────────────────────────────────────────────
// Required because @capacitor/camera is used with CameraSource.Camera.
// Binary upload will be rejected without this key.
ensureKey(
  'NSCameraUsageDescription',
  `<key>NSCameraUsageDescription</key>\n\t<string>Swara AI uses the camera so you can take a profile photo.</string>`,
  /(<key>NSUserTrackingUsageDescription<\/key>\s*<string>[^<]*<\/string>)/,
  'NSCameraUsageDescription',
);

// ── 3. NSPhotoLibraryUsageDescription ────────────────────────────────────────
// Required because @capacitor/camera is used with CameraSource.Photos.
// Binary upload will be rejected without this key.
ensureKey(
  'NSPhotoLibraryUsageDescription',
  `<key>NSPhotoLibraryUsageDescription</key>\n\t<string>Swara AI accesses your photo library so you can choose a profile photo.</string>`,
  /(<key>NSCameraUsageDescription<\/key>\s*<string>[^<]*<\/string>)/,
  'NSPhotoLibraryUsageDescription',
);

// ── 4. ITSAppUsesNonExemptEncryption ─────────────────────────────────────────
// The app uses only standard HTTPS/TLS — exempt encryption under US EAR.
// Without this key every submission is held for manual export compliance review.
ensureKey(
  'ITSAppUsesNonExemptEncryption',
  `<key>ITSAppUsesNonExemptEncryption</key>\n\t<false/>`,
  /(<key>NSPhotoLibraryUsageDescription<\/key>\s*<string>[^<]*<\/string>)/,
  'ITSAppUsesNonExemptEncryption',
);

// ── 5. UIRequiredDeviceCapabilities — replace armv7 with microphone ───────────
// armv7 is a stale 32-bit architecture; all modern Capacitor SDKs are arm64-only.
// Declaring `microphone` accurately reflects the app's core hardware requirement.
if (plist.includes('<string>armv7</string>')) {
  plist = plist.replace('<string>armv7</string>', '<string>microphone</string>');
  console.log('✓ Replaced armv7 with microphone in UIRequiredDeviceCapabilities');
} else {
  console.log('✓ UIRequiredDeviceCapabilities already updated');
}

writeFileSync(infoPlistPath, plist, 'utf8');
console.log('\niOS plist patch complete.');
