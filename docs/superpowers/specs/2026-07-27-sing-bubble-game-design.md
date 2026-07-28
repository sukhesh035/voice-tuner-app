# Sing Page — Note Bubble Game Design

## Overview

Replace the static "Notes Detected" grid on the Sing page with an interactive bubble game. A random note bounces around the screen; the user sings to match it, sees guidance arrows, and the bubble pops on a correct hit. Score is tracked for logged-in users.

## Architecture

### What Changes

- **Modify:** `apps/mobile-app/src/app/pages/sing/sing.page.ts` — Replace the note-grid template section with the game area; add game logic to the component class
- **Modify:** `apps/mobile-app/src/app/pages/sing/sing.page.scss` — Add styles for bubble, pop animation, guidance arrows, score display
- **No new files** — all changes in the existing Sing page

### Game Area (replaces "Notes Detected" grid)

```
┌──────────────────────────────────┐
│           (bouncing bubble)       │
│     ┌──────────────┐             │
│     │     Re♭      │             │
│     └──────────────┘             │
│           ↑                      │
│         higher                   │
│                                  │
│   ✓ 5/8   Streak 3              │ ← score (logged-in only)
└──────────────────────────────────┘
```

### Bubble Animation

- **Technique:** `requestAnimationFrame` loop updating CSS `transform: translate(x, y)`
- **Physics:** Store `x, y, vx, vy`; on each frame `x += vx, y += vy`; reverse velocity on wall collision
- **Speed:** ~120px/s (adjustable), starting in a random direction
- **Spawn:** Each new note starts at a random position within the game area
- **On tab leave:** Cancel the animation frame

### Guidance Arrows

- When user sings any pitch, compare detected `indianNote` to target note
- If target is higher than detected → show `↑ higher` below the bubble
- If target is lower than detected → show `↓ lower`
- If within ±10¢ (or correct note) → hide arrows

### Pop Animation

- On correct hit (`currentPitch.indianNote === targetNote && currentPitch.isInTune`):
  - Add CSS class `.popping` to bubble
  - `@keyframes pop`: scale(1) → scale(1.5) → scale(0) + fade out, ~400ms
  - After animation ends, remove class, pick next random note, reset position
- Bubble shows the next note name immediately

### Game State

```typescript
targetNote: IndianNote | null = null;
correctCount = 0;
totalCount = 0;
streak = 0;
bubbleX = 100;
bubbleY = 100;
bubbleVx = 1.5;
bubbleVy = 1.2;
isPopping = false;
guidance: '' | 'higher' | 'lower' = '';
```

### Score Display

- Only rendered when `authService.currentUser` is truthy
- Shows: `✓ {correctCount}/{totalCount}   Streak {streak}`
- Resets on "Start Singing"

### Game Flow

1. User taps **Start Singing** → pitch detection starts → pick first random note from `scaleNoteSet`
2. Bubble begins bouncing with that note name
3. On each pitch result (throttled at 50ms):
   - Compare detected note to target
   - If wrong note or out of tune → set `guidance` to `'higher'` or `'lower'`
   - If correct note + in tune → trigger pop (increment counts, pick next note)
4. User taps **Stop Singing** → final score shown, bubble hidden

### Edge Cases

- **User stops mid-game:** Bubble hidden, score resets, animation canceled
- **User changes key/scale mid-game:** Restart with new random note from updated scale
- **All notes in scale exhausted:** Random selection (can repeat)
- **Container resize:** Bubble position clamped to new bounds on next frame
- **No pitch detected (silence):** Guidance arrows hidden, bubble keeps bouncing

## Files to modify

| File | Action |
|------|--------|
| `apps/mobile-app/src/app/pages/sing/sing.page.ts` | Modify — replace note grid with game area, add game logic |
| `apps/mobile-app/src/app/pages/sing/sing.page.scss` | Modify — add bubble, pop, guidance, score styles |