# Sing Page — Guided Note Mode Design

## Overview

Add two singing modes to the Sing page: **Free Flow** (existing behavior) and **Guided Note** (pick a target note and get real-time correction). Replace the read-only "Notes Detected" grid with a **selectable note grid** that sets the target in guided mode.

## Architecture

### Mode toggle

Add a segment control above the pitch meter:

```html
<ion-segment [(ngModel)]="singMode" class="sing-mode-segment">
  <ion-segment-button value="free">Free Flow</ion-segment-button>
  <ion-segment-button value="guided">Guided Note</ion-segment-button>
</ion-segment>
```

State:
```typescript
singMode: 'free' | 'guided' = 'free';
targetNote: IndianNote | null = null;
```

### Selectable note grid (replaces "Notes Detected")

- Shows only notes in the selected scale (`scaleNoteSet`), out-of-scale notes dimmed.
- In **guided** mode, tapping a note sets `targetNote`; tapped note gets a `.selected` highlight.
- In **free** mode, the grid remains visible and the current pitch note highlights (like the old detected-note behavior), but taps do nothing.
- When target is matched in tune, the target chip gets `.hit` (green).

Template:
```html
<div class="note-grid-section">
  <div class="section-title">
    {{ singMode === 'guided' ? 'Select a Note' : 'Notes Detected' }}
    <span class="scale-badge">{{ selectedRoot }} {{ selectedScale.label }}</span>
  </div>
  <div class="swara-note-grid">
    @for (note of allNotes; track note; let i = $index) {
    <div
      class="note-chip"
      [class.selected]="singMode === 'guided' && targetNote === note"
      [class.current]="currentPitch?.indianNote === note"
      [class.hit]="singMode === 'guided' && targetNote === note && isTargetInTune"
      [class.out-of-scale]="!scaleNoteSet.has(note)"
      [style.--note-color]="noteColors[i]"
      (click)="singMode === 'guided' && selectTarget(note)"
    >
      <span class="note-name">{{ note }}</span>
    </div>
    }
  </div>
</div>
```

### Guidance display (guided mode)

Below the pitch meter, show a guidance banner:

```html
@if (singMode === 'guided') {
<div class="guidance-banner" [class]="guidanceClass">
  @if (targetNote) {
    @if (!currentPitch) {
      <span>Sing {{ targetNote }}...</span>
    } @else if (isTargetInTune) {
      <span>✓ Perfect {{ targetNote }}!</span>
    } @else {
      <span>{{ guidanceMessage }}</span>
    }
  } @else {
    <span>Tap a note to sing it</span>
  }
</div>
}
```

### Guidance logic

New getters on the component:

```typescript
get isTargetInTune(): boolean {
  return !!this.targetNote
    && this.currentPitch?.indianNote === this.targetNote
    && this.currentPitch?.isInTune;
}

get guidanceClass(): 'good' | 'up' | 'down' | 'idle' {
  if (this.isTargetInTune) return 'good';
  if (!this.currentPitch || !this.targetNote) return 'idle';
  const pitchIdx = INDIAN_NOTES.indexOf(this.currentPitch.indianNote);
  const targetIdx = INDIAN_NOTES.indexOf(this.targetNote);
  if (pitchIdx < targetIdx) return 'up';
  if (pitchIdx > targetIdx) return 'down';
  // same note but off-tune → use cents
  return (this.currentPitch.centsOff ?? 0) > 0 ? 'down' : 'up';
}

get guidanceMessage(): string {
  if (!this.targetNote || !this.currentPitch) return '';
  const cls = this.guidanceClass;
  if (cls === 'up')   return `↑ Sing higher — you're at ${this.currentPitch.indianNote}`;
  if (cls === 'down') return `↓ Sing lower — you're at ${this.currentPitch.indianNote}`;
  const cents = Math.abs(this.currentPitch.centsOff ?? 0);
  if (cents <= 10) return `You're on ${this.targetNote}, hold it steady`;
  return (this.currentPitch.centsOff ?? 0) > 0
    ? `Sing slightly lower — you're ${cents.toFixed(0)}¢ sharp`
    : `Sing slightly higher — you're ${cents.toFixed(0)}¢ flat`;
}
```

### `selectTarget` method

```typescript
selectTarget(note: IndianNote): void {
  this.targetNote = note;
  this.analytics.logEvent('sing_target_selected', { note });
  this.cdr.markForCheck();
}
```

### Mode switch behavior

When switching to `free`, clear `targetNote`. When switching to `guided`, keep the last selected target if any (or null).

## Files to modify

| File | Change |
|------|--------|
| `apps/mobile-app/src/app/pages/sing/sing.page.ts` | Add mode toggle, selectable grid, guidance getters, selectTarget, singMode/targetNote state |
| `apps/mobile-app/src/app/pages/sing/sing.page.scss` | Styles for segment, selected/hit chips, guidance banner |

## Success Criteria

- Free Flow mode works exactly as before (no behavior change)
- In Guided Note mode, tapping a note sets the target and shows live higher/lower/perfect guidance
- Out-of-scale notes are dimmed and not selectable in guided mode
- Analytics logs target selection
