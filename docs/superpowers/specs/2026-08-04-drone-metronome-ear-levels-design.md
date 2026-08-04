# Drone + Metronome, Practice Drone, and Ear Training Levels Design

## Overview

Three related practice improvements plus cross-cutting analytics:

1. **Drone + Metronome combo** — a drone (tanpura) card inside the Metronome tab
2. **Practice with tanpura drone** — a drone toggle on the Sing page so the drone keeps playing while singing
3. **Ear training difficulty levels** — level selector restricting the note pool
4. **Analytics** for all of the above

## Architecture

### 1. Drone + Metronome (Metronome tab)

Add a Drone card below the BPM display in `metronome.page.ts`:

- **Drone toggle** (IonToggle) → `TanpuraPlayerService.toggle()`
- **Key selector** (IonSelect or segmented buttons C–B) → `tanpura.setKey(key)`
- **Volume slider** (IonRange 0–1) → `tanpura.setVolume(v)`
- Drone is **independent** of the metronome start/stop
- `ionViewWillLeave` stops both the metronome timer and the drone (`tanpura.stop()`)
- `ngOnDestroy` also stops the drone

The tanpura player and metronome use separate AudioContexts (`AudioEngineService` vs the metronome's own `AudioContext`), so they can play simultaneously.

### 2. Practice with tanpura drone (Sing page)

Add a compact **Drone toggle** in the Sing page mic section (above the Start Singing button):

- IonToggle "Drone" → `tanpura.toggle()`
- Uses the same `TanpuraPlayerService` instance
- The drone keeps playing while the user sings (pitch meter reads mic independently)
- On tab leave (`ionViewWillLeave`), stop the drone if it's playing
- Session save already reads `tanpura.state.key`, so the drone key automatically records in the session

### 3. Ear training difficulty levels (Practice page)

Add a **level selector** on the Ear Training intro screen (visible when `!sessionActive`):

- **Level 1 — Sa, Re, Ga** (`['Sa','Re','Ga']`)
- **Level 2 — Sa–Pa** (`['Sa','Re','Ga','Ma','Pa']`)
- **Level 3 — Full octave** (all 12 notes, current behavior)

State:
```typescript
earLevel: 1 | 2 | 3 = 1;
```

The `drawEarNote()` method filters the pool by level:
```typescript
private drawEarNote(): IndianNote {
  const pool = EAR_LEVEL_NOTES[this.earLevel];
  if (this.earNotePool.length === 0) {
    this.earNotePool = this.shuffle(pool);
  }
  return this.earNotePool.pop()!;
}
```

Where:
```typescript
const EAR_LEVEL_NOTES: Record<1 | 2 | 3, IndianNote[]> = {
  1: ['Sa','Re','Ga'],
  2: ['Sa','Re','Ga','Ma','Pa'],
  3: ALL_SHRUTI_NOTES,
};
```

### 4. Analytics (analytics.service.ts)

Add typed helpers or use `logEvent` directly:
- `drone_toggled` — `{ on: boolean, source: 'metronome' | 'sing' }`
- `drone_key_changed` — `{ key: string, source }`
- `drone_volume_changed` — `{ volume: number }`
- `ear_level_selected` — `{ level: 1|2|3 }`
- `ear_training_started` — `{ level: 1|2|3 }` (fire in `startSession` for free mode)

## Files to modify

| File | Change |
|------|--------|
| `apps/mobile-app/src/app/pages/metronome/metronome.page.ts` | Add Drone card template + logic |
| `apps/mobile-app/src/app/pages/metronome/metronome.page.scss` | Drone card styles |
| `apps/mobile-app/src/app/pages/sing/sing.page.ts` | Add drone toggle |
| `apps/mobile-app/src/app/pages/sing/sing.page.scss` | Drone toggle styles |
| `apps/mobile-app/src/app/pages/practice/practice.page.ts` | Ear levels state + template + drawEarNote |
| `apps/mobile-app/src/app/pages/practice/practice.page.scss` | Level selector styles |
| `apps/mobile-app/src/app/core/services/analytics.service.ts` | Add typed event helpers (if needed) |

## Success Criteria

- User can play tanpura drone and metronome simultaneously from the Metronome tab
- User can enable the drone on the Sing page and it persists while singing
- Ear training restricts notes by selected level
- All interactions logged to analytics
