#!/usr/bin/env node
/**
 * generate-assets.mjs
 *
 * Generates all app icon and splash screen variants from the two source files:
 *   apps/mobile-app/resources/icon.png   (1024×1024)
 *   apps/mobile-app/resources/splash.png (2732×2732)
 *
 * Outputs:
 *   iOS    → ios/App/App/Assets.xcassets/AppIcon.appiconset/
 *            ios/App/App/Assets.xcassets/Splash.imageset/
 *   Android→ android/app/src/main/res/mipmap-*/  (ic_launcher + ic_launcher_round)
 *            android/app/src/main/res/drawable-*/  (splash.png)
 *   PWA    → apps/mobile-app/src/assets/icons/
 *
 * Usage:
 *   pnpm cap:generate-assets
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const require = createRequire(import.meta.url);
const sharp   = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');
const iconSrc   = resolve(root, 'apps/mobile-app/resources/icon.png');
const splashSrc = resolve(root, 'apps/mobile-app/resources/splash.png');

async function resize(src, dest, w, h) {
  mkdirSync(dirname(dest), { recursive: true });
  await sharp(src).resize(w, h).png().toFile(dest);
  console.log(`  ✔  ${dest.replace(root + '/', '')}  (${w}×${h})`);
}

async function main() {
  console.log('\nGenerating Sruti app assets…\n');

  // ── iOS ──────────────────────────────────────────────────────────────────
  const iosIcons  = resolve(root, 'apps/mobile-app/ios/App/App/Assets.xcassets/AppIcon.appiconset');
  const iosSplash = resolve(root, 'apps/mobile-app/ios/App/App/Assets.xcassets/Splash.imageset');

  await resize(iconSrc,   resolve(iosIcons,  'AppIcon-512@2x.png'), 1024, 1024);
  await resize(splashSrc, resolve(iosSplash, 'splash-2732x2732.png'),   2732, 2732);
  await resize(splashSrc, resolve(iosSplash, 'splash-2732x2732-1.png'), 2732, 2732);
  await resize(splashSrc, resolve(iosSplash, 'splash-2732x2732-2.png'), 2732, 2732);

  // ── Android mipmaps ───────────────────────────────────────────────────────
  const androidRes = resolve(root, 'apps/mobile-app/android/app/src/main/res');
  const mipmaps = [
    ['mipmap-mdpi',    48],
    ['mipmap-hdpi',    72],
    ['mipmap-xhdpi',   96],
    ['mipmap-xxhdpi',  144],
    ['mipmap-xxxhdpi', 192],
  ];
  for (const [dir, size] of mipmaps) {
    await resize(iconSrc, resolve(androidRes, dir, 'ic_launcher.png'),       size, size);
    await resize(iconSrc, resolve(androidRes, dir, 'ic_launcher_round.png'), size, size);
    await resize(iconSrc, resolve(androidRes, dir, 'ic_launcher_foreground.png'), size, size);
  }

  // ── Android splash drawables ──────────────────────────────────────────────
  const splashSizes = {
    'drawable-port-mdpi':    [320,  480],
    'drawable-port-hdpi':    [480,  800],
    'drawable-port-xhdpi':   [720,  1280],
    'drawable-port-xxhdpi':  [960,  1600],
    'drawable-port-xxxhdpi': [1280, 1920],
    'drawable-land-mdpi':    [480,  320],
    'drawable-land-hdpi':    [800,  480],
    'drawable-land-xhdpi':   [1280, 720],
    'drawable-land-xxhdpi':  [1600, 960],
    'drawable-land-xxxhdpi': [1920, 1280],
  };
  for (const [dir, [w, h]] of Object.entries(splashSizes)) {
    await resize(splashSrc, resolve(androidRes, dir, 'splash.png'), w, h);
  }

  // ── PWA icons ─────────────────────────────────────────────────────────────
  const pwaIcons = resolve(root, 'apps/mobile-app/src/assets/icons');
  await resize(iconSrc, resolve(pwaIcons, 'icon-192x192.png'), 192, 192);
  await resize(iconSrc, resolve(pwaIcons, 'icon-512x512.png'), 512, 512);

  console.log('\nAll assets generated successfully.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
