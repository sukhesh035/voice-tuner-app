#!/usr/bin/env node
/**
 * patch-android.mjs
 *
 * Patches the Capacitor-generated Android Gradle files to add the Firebase
 * Crashlytics Gradle plugin. The android/ folder is regenerated on every
 * `cap sync`, so this script must run after each sync (e.g. in CI).
 *
 * Usage:
 *   node scripts/patch-android.mjs
 *
 * Must be run from the workspace root.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const androidDir = resolve(__dirname, '../apps/mobile-app/android');

// ── 1. Root build.gradle — add Crashlytics classpath ────────────────────────
const rootGradlePath = resolve(androidDir, 'build.gradle');
let rootGradle = readFileSync(rootGradlePath, 'utf8');

const crashlyticsClasspath = `classpath 'com.google.firebase:firebase-crashlytics-gradle:3.0.3'`;

if (rootGradle.includes(crashlyticsClasspath)) {
  console.log('✓ Crashlytics classpath already present in root build.gradle');
} else {
  rootGradle = rootGradle.replace(
    `classpath 'com.google.gms:google-services:4.4.4'`,
    `classpath 'com.google.gms:google-services:4.4.4'\n        ${crashlyticsClasspath}`,
  );
  writeFileSync(rootGradlePath, rootGradle, 'utf8');
  console.log('✓ Added Crashlytics classpath to root build.gradle');
}

// ── 2. app/build.gradle — apply the Crashlytics plugin ──────────────────────
const appGradlePath = resolve(androidDir, 'app/build.gradle');
let appGradle = readFileSync(appGradlePath, 'utf8');

const applyPlugin = `apply plugin: 'com.google.firebase.crashlytics'`;

if (appGradle.includes(applyPlugin)) {
  console.log('✓ Crashlytics plugin already applied in app/build.gradle');
} else {
  appGradle = appGradle.replace(
    `apply plugin: 'com.google.gms.google-services'`,
    `apply plugin: 'com.google.gms.google-services'\n        ${applyPlugin}`,
  );
  writeFileSync(appGradlePath, appGradle, 'utf8');
  console.log('✓ Applied Crashlytics plugin in app/build.gradle');
}

// ── 2a. app/build.gradle — enable R8 minification for release ───────────────
// Play flags AABs whose DEX obfuscation is below 25%. Capacitor generates
// minifyEnabled false, so enable R8 + the optimized default rules.
appGradle = readFileSync(appGradlePath, 'utf8');
const r8Patched = appGradle
  .replace(/minifyEnabled\s+false/g, 'minifyEnabled true')
  .replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');

if (r8Patched !== appGradle) {
  writeFileSync(appGradlePath, r8Patched, 'utf8');
  console.log('✓ Enabled R8 minification in app/build.gradle');
} else {
  console.log('✓ R8 minification already enabled in app/build.gradle');
}

// ── 2b. app/proguard-rules.pro — keep the Capacitor WebView bridge ──────────
// @JavascriptInterface methods are invoked from JS by name. R8 must not
// rename/remove them.
const proguardPath = resolve(androidDir, 'app/proguard-rules.pro');
let proguard = existsSync(proguardPath) ? readFileSync(proguardPath, 'utf8') : '';

if (!proguard.includes('@android.webkit.JavascriptInterface')) {
  proguard = `${proguard.trimEnd()}

# Capacitor's WebView bridge calls these methods from JavaScript by name.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
`;
  writeFileSync(proguardPath, proguard, 'utf8');
  console.log('✓ Added JavascriptInterface keep rule to proguard-rules.pro');
} else {
  console.log('✓ JavascriptInterface keep rule already present');
}

// ── 3. app/build.gradle — set versionCode and versionName ───────────────────
// versionCode must be an integer > any previously uploaded version.
// versionName is the human-readable string shown in Play Store.
appGradle = readFileSync(appGradlePath, 'utf8');
appGradle = appGradle.replace(/versionCode\s+\d+/, 'versionCode 2');
appGradle = appGradle.replace(/versionName\s+"[^"]*"/, 'versionName "1.1"');
writeFileSync(appGradlePath, appGradle, 'utf8');
console.log('✓ Set versionCode=2 and versionName="1.1" in app/build.gradle');

console.log('\nAndroid Gradle patch complete.');

// ── 4. AndroidManifest.xml — ensure RECORD_AUDIO + MODIFY_AUDIO_SETTINGS permissions are declared ─
//   Capacitor's WebView getUserMedia requires both RECORD_AUDIO and
//   MODIFY_AUDIO_SETTINGS in the native manifest. Without them, Android
//   silently denies mic access without ever prompting the user.
//   (cr_media: "Requires MODIFY_AUDIO_SETTINGS and RECORD_AUDIO. No audio
//    device will be available for recording")
const manifestPath = resolve(androidDir, 'app/src/main/AndroidManifest.xml');
let manifest = readFileSync(manifestPath, 'utf8');

const requiredPermissions = [
  { name: 'android.permission.RECORD_AUDIO', label: 'RECORD_AUDIO' },
  { name: 'android.permission.MODIFY_AUDIO_SETTINGS', label: 'MODIFY_AUDIO_SETTINGS' },
];

for (const perm of requiredPermissions) {
  if (manifest.includes(perm.name)) {
    console.log(`✓ ${perm.label} permission already present in AndroidManifest.xml`);
  } else {
    manifest = manifest.replace(
      '<application',
      `<uses-permission android:name="${perm.name}" />\n    <application`,
    );
    writeFileSync(manifestPath, manifest, 'utf8');
    // Re-read after write so the next iteration sees the updated content
    manifest = readFileSync(manifestPath, 'utf8');
    console.log(`✓ Added ${perm.label} permission to AndroidManifest.xml`);
  }
}

console.log('\nAndroid patch complete.');
