# Metronome Tab Design

## Overview

Replace the tanpura tab with a metronome tab. A basic metronome that plays an audio click on each beat with an adjustable tempo and visual beat indicator.

## Architecture

### Tab Bar Changes

- `tabs.component.ts`: Replace `tab="tanpura"` with `tab="metronome"`, icon changes from `musical-note-outline` to `timer-outline`
- `app.routes.ts`: Replace path `tanpura` → `metronome`, component `TanpuraPage` → `MetronomePage`
- New page: `apps/mobile-app/src/app/pages/metronome/metronome.page.ts`

### Metronome Page

**Layout:**
- Header: "Metronome"
- Large BPM display (editable input field, centered)
- Slider (ion-range, min 20, max 250, step 1)
- Play/Stop button (centered, toggles between play/stop state)
- Beat indicator: a circle that pulses/flashes on each beat

**Audio:**
- Uses Web Audio API `AudioContext` directly
- Each beat: short oscillator burst (~20ms) via `OscillatorNode` + `GainNode`
- Clean up: close `AudioContext` on stop / tab leave

**Timing:**
- Uses `setInterval` with interval = `60000 / bpm` ms
- On each tick: play click sound + trigger visual flash

**State (component-local signals):**
- `bpm: signal<number>(120)` — default 120, range 20–250
- `isPlaying: signal<boolean>(false)`

### Files to create/modify

| File | Action |
|------|--------|
| `apps/mobile-app/src/app/pages/metronome/metronome.page.ts` | Create — metronome component |
| `apps/mobile-app/src/app/pages/metronome/metronome.page.scss` | Create — styles |
| `apps/mobile-app/src/app/tabs/tabs.component.ts` | Modify — replace tanpura tab with metronome |
| `apps/mobile-app/src/app/app.routes.ts` | Modify — replace tanpura route with metronome |
| `apps/mobile-app/src/app/pages/tanpura/` | Delete — entire directory |

### Edge Cases

- **Tab switch while playing:** Stop metronome on `ionViewWillLeave` (same pattern as tanpura)
- **Invalid BPM input:** Clamp to 20–250 on blur
- **AudioContext suspended:** Resume on first play (browsers require user gesture)
- **Rapid BPM changes while playing:** Clear interval and restart with new BPM

## Success Criteria

- Metronome plays steady audio clicks at the set BPM
- Visual indicator flashes on each beat
- BPM adjustable via slider and direct text input
- Play state persists across tab switches? No, stop on tab leave
- Clean audio — no hanging clicks or overlapping sounds