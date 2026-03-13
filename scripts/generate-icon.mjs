#!/usr/bin/env node
/**
 * generate-icon.mjs
 *
 * Generates icon.png (1024×1024) and splash.png (2732×2732) for Swara AI,
 * matching the existing dark-glassmorphism design with "Swara AI" text.
 *
 * Usage: node scripts/generate-icon.mjs
 */

import { createRequire } from 'module';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const require  = createRequire(import.meta.url);
const sharp    = require('sharp');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = resolve(__dirname, '..');
const outIcon   = resolve(root, 'apps/mobile-app/resources/icon.png');
const outSplash = resolve(root, 'apps/mobile-app/resources/splash.png');

// ── Icon SVG (1024×1024) ──────────────────────────────────────────────────────
function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <!-- Background gradient -->
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="#1A0A3B"/>
      <stop offset="100%" stop-color="#0A0A1B"/>
    </radialGradient>

    <!-- Main oval / circle gradient (blue-purple → magenta) -->
    <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#7B6EF6"/>
      <stop offset="50%"  stop-color="#9B4DCA"/>
      <stop offset="100%" stop-color="#C832CC"/>
    </linearGradient>

    <!-- Text gradient -->
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#7B6EF6"/>
      <stop offset="50%"  stop-color="#9B4DCA"/>
      <stop offset="100%" stop-color="#C832CC"/>
    </linearGradient>

    <!-- Glow filter for center dot -->
    <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>

    <!-- Subtle glow on the main rings -->
    <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1024" height="1024" fill="url(#bgGrad)" rx="180"/>

  <!-- Outer faint concentric circles (decorative) -->
  <circle cx="512" cy="390" r="400" fill="none" stroke="rgba(150,100,255,0.12)" stroke-width="1.5"/>
  <circle cx="512" cy="390" r="340" fill="none" stroke="rgba(150,100,255,0.15)" stroke-width="1.5"/>
  <circle cx="512" cy="390" r="280" fill="none" stroke="rgba(150,100,255,0.18)" stroke-width="1.5"/>

  <!-- Outer oval ring (bottom edge = 370+185 = 555) -->
  <ellipse cx="512" cy="370" rx="255" ry="185"
    fill="none" stroke="url(#mainGrad)" stroke-width="11"
    filter="url(#ringGlow)" opacity="0.95"/>

  <!-- Inner oval ring -->
  <ellipse cx="512" cy="370" rx="162" ry="112"
    fill="none" stroke="url(#mainGrad)" stroke-width="9"
    filter="url(#ringGlow)" opacity="0.9"/>

  <!-- Center dot with glow -->
  <circle cx="512" cy="370" r="18" fill="white" filter="url(#dotGlow)" opacity="0.95"/>
  <circle cx="512" cy="370" r="10" fill="white"/>

  <!-- "Swara AI" text — sits below outer oval bottom edge (~555), baseline at 740 -->
  <text
    x="512" y="740"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="108"
    font-weight="bold"
    text-anchor="middle"
    fill="url(#textGrad)"
  >Swara AI</text>
</svg>`;
}

// ── Splash SVG (2732×2732) ────────────────────────────────────────────────────
function splashSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="50%" r="70%">
      <stop offset="0%"   stop-color="#1A0A3B"/>
      <stop offset="100%" stop-color="#0A0A1B"/>
    </radialGradient>
    <linearGradient id="mainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="#7B6EF6"/>
      <stop offset="50%"  stop-color="#9B4DCA"/>
      <stop offset="100%" stop-color="#C832CC"/>
    </linearGradient>
    <linearGradient id="textGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%"   stop-color="#7B6EF6"/>
      <stop offset="50%"  stop-color="#9B4DCA"/>
      <stop offset="100%" stop-color="#C832CC"/>
    </linearGradient>
    <filter id="dotGlow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="ringGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="2732" height="2732" fill="url(#bgGrad)"/>

  <!-- Outer faint concentric circles -->
  <circle cx="1366" cy="1040" r="1068" fill="none" stroke="rgba(150,100,255,0.10)" stroke-width="3"/>
  <circle cx="1366" cy="1040" r="907"  fill="none" stroke="rgba(150,100,255,0.13)" stroke-width="3"/>
  <circle cx="1366" cy="1040" r="746"  fill="none" stroke="rgba(150,100,255,0.16)" stroke-width="3"/>

  <!-- Outer oval ring (bottom edge = 1040+520 = 1560) -->
  <ellipse cx="1366" cy="1040" rx="680" ry="520"
    fill="none" stroke="url(#mainGrad)" stroke-width="28"
    filter="url(#ringGlow)" opacity="0.95"/>

  <!-- Inner oval ring -->
  <ellipse cx="1366" cy="1040" rx="432" ry="320"
    fill="none" stroke="url(#mainGrad)" stroke-width="23"
    filter="url(#ringGlow)" opacity="0.9"/>

  <!-- Center dot -->
  <circle cx="1366" cy="1040" r="48" fill="white" filter="url(#dotGlow)" opacity="0.95"/>
  <circle cx="1366" cy="1040" r="26" fill="white"/>

  <!-- "Swara AI" text — baseline at 1760, clearly below oval bottom edge (~1560) -->
  <text
    x="1366" y="1760"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="288"
    font-weight="bold"
    text-anchor="middle"
    fill="url(#textGrad)"
  >Swara AI</text>
</svg>`;
}

async function main() {
  console.log('\nGenerating Swara AI icon and splash…\n');

  // Icon — flatten to remove alpha (App Store requires no alpha channel)
  await sharp(Buffer.from(iconSvg()))
    .resize(1024, 1024)
    .flatten({ background: { r: 10, g: 10, b: 27 } })
    .png()
    .toFile(outIcon);
  console.log('  ✔  apps/mobile-app/resources/icon.png  (1024×1024)');

  // Splash — no alpha needed
  await sharp(Buffer.from(splashSvg()))
    .resize(2732, 2732)
    .flatten({ background: { r: 10, g: 10, b: 27 } })
    .png()
    .toFile(outSplash);
  console.log('  ✔  apps/mobile-app/resources/splash.png  (2732×2732)');

  console.log('\nDone. Run `pnpm cap:generate-assets` to propagate to iOS/Android/PWA.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
