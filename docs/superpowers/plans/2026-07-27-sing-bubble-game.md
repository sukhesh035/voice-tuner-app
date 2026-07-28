# Sing Page — Note Bubble Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "Notes Detected" grid on the Sing page with an interactive bubble game where a random note bounces around and pops when the user sings it correctly.

**Architecture:** All changes within the existing `sing.page.ts` and `sing.page.scss`. The note grid template section is replaced with a game area containing a bouncing bubble, guidance arrows, and score display. Game state managed via class properties. Bubble animation uses `requestAnimationFrame`.

**Tech Stack:** Angular, Ionic standalone, requestAnimationFrame, CSS keyframes

---

### Task 1: Add Game State and Logic to SingPage Component

**Files:**
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.ts`

- [ ] **Add game state properties to the `SingPage` class**

Add these properties after the existing `sessionStats` and before `micError`:

```typescript
  // ── Game state ───────────────────────────────────────────
  targetNote: IndianNote | null = null;
  correctCount = 0;
  totalCount = 0;
  streak = 0;
  bubbleX = 150;
  bubbleY = 100;
  bubbleVx = 1.5;
  bubbleVy = 1.2;
  isPopping = false;
  guidance: '' | 'higher' | 'lower' = '';
  private animFrameId: number | null = null;
  private gameAreaEl: HTMLElement | null = null;
```

- [ ] **Add the `pickRandomNote` method after `updateScaleNoteSet`**

```typescript
  private pickRandomNote(): void {
    const scaleNotes = Array.from(this.scaleNoteSet);
    if (scaleNotes.length === 0) return;
    const idx = Math.floor(Math.random() * scaleNotes.length);
    this.targetNote = scaleNotes[idx];
    this.guidance = '';
    this.spawnBubble();
  }
```

- [ ] **Add bubble animation methods after `pickRandomNote`**

```typescript
  private spawnBubble(): void {
    if (!this.gameAreaEl) return;
    const rect = this.gameAreaEl.getBoundingClientRect();
    this.bubbleX = 20 + Math.random() * (rect.width - 140);
    this.bubbleY = 20 + Math.random() * (rect.height - 80);
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.2 + Math.random() * 0.6;
    this.bubbleVx = Math.cos(angle) * speed;
    this.bubbleVy = Math.sin(angle) * speed;
    this.cdr.markForCheck();
    this.startBounceLoop();
  }

  private startBounceLoop(): void {
    if (this.animFrameId !== null) return;
    const loop = () => {
      if (!this.isActive || this.isPopping || !this.gameAreaEl) {
        this.animFrameId = null;
        return;
      }
      this.bubbleX += this.bubbleVx;
      this.bubbleY += this.bubbleVy;
      const rect = this.gameAreaEl.getBoundingClientRect();
      const bubbleW = 100;
      const bubbleH = 44;
      if (this.bubbleX <= 0) { this.bubbleX = 0; this.bubbleVx = Math.abs(this.bubbleVx); }
      if (this.bubbleX >= rect.width - bubbleW) { this.bubbleX = rect.width - bubbleW; this.bubbleVx = -Math.abs(this.bubbleVx); }
      if (this.bubbleY <= 0) { this.bubbleY = 0; this.bubbleVy = Math.abs(this.bubbleVy); }
      if (this.bubbleY >= rect.height - bubbleH) { this.bubbleY = rect.height - bubbleH; this.bubbleVy = -Math.abs(this.bubbleVy); }
      try { this.cdr.markForCheck(); } catch {}
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopBounceLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }
```

- [ ] **Update the pitch subscription in `ngOnInit` to handle game logic**

Replace the existing subscription:

```typescript
    this.pitchDetection.pitch$
      .pipe(takeUntil(this.destroy$), throttleTime(50))
      .subscribe(pitch => {
        this.currentPitch = pitch;
        if (pitch) this.detectedNotes.add(pitch.indianNote);
        if (pitch && this.targetNote && this.isActive && !this.isPopping) {
          if (pitch.indianNote === this.targetNote && pitch.isInTune) {
            this.totalCount++;
            this.streak++;
            this.correctCount++;
            this.guidance = '';
            this.isPopping = true;
            this.stopBounceLoop();
            setTimeout(() => {
              this.isPopping = false;
              this.pickRandomNote();
            }, 400);
          } else {
            if (pitch.indianNote !== this.targetNote) {
              const targetIdx = INDIAN_NOTES.indexOf(this.targetNote);
              const pitchIdx = INDIAN_NOTES.indexOf(pitch.indianNote);
              this.guidance = pitchIdx < targetIdx ? 'higher' : 'lower';
            } else {
              this.guidance = '';
            }
          }
        }
        try { this.cdr.markForCheck(); } catch {}
      });
```

- [ ] **Reset game state when "Start Singing" is pressed**

In `toggleMic()`, inside the `else` branch (start), after `this.detectedNotes.clear()` add:

```typescript
        this.correctCount = 0;
        this.totalCount = 0;
        this.streak = 0;
        this.isPopping = false;
        this.pickRandomNote();
```

- [ ] **Reset game state when stopping**

In `toggleMic()`, in the `if (this.isActive)` branch (stop), before `this.analytics.logEvent('mic_stopped', ...)` add:

```typescript
      this.stopBounceLoop();
      this.targetNote = null;
      this.guidance = '';
      this.isPopping = false;
```

Also add the same in `ionViewWillLeave()` before `this.analytics.logEvent('mic_stopped', ...)`.

---

### Task 2: Replace Template and Add Game Styles

**Files:**
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.ts` — replace note grid template
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.scss` — add game styles

- [ ] **Replace the "Notes Detected" grid template with the game area**

Find the note-grid-section div (lines 218-236 in the current file):

```html
        <!-- Note Grid (Carnatic / Sargam) -->
        <div class="note-grid-section">
          <div class="section-title">
            Notes Detected
            <span class="scale-badge">{{ selectedRoot }} {{ selectedScale.label }}</span>
          </div>
          <div class="swara-note-grid">
            @for (note of allNotes; track note; let i = $index) {
            <div
              class="note-chip"
              [class.active]="detectedNotes.has(note)"
              [class.current]="currentPitch?.indianNote === note"
              [class.out-of-scale]="!scaleNoteSet.has(note)"
              [style.--note-color]="noteColors[i]"
            >
              <span class="note-name">{{ note }}</span>
            </div>
            }
          </div>
        </div>
```

Replace with:

```html
        <!-- Bubble Game Area -->
        <div class="game-area" #gameArea>
          @if (isActive && targetNote) {
          <div
            class="bubble"
            [class.popping]="isPopping"
            [style.transform]="'translate(' + bubbleX + 'px, ' + bubbleY + 'px)'"
          >
            <span class="bubble-note">{{ targetNote }}</span>
          </div>
          @if (guidance) {
          <div
            class="guidance"
            [class.guidance-up]="guidance === 'higher'"
            [class.guidance-down]="guidance === 'lower'"
            [style.left]="(bubbleX + 50) + 'px'"
            [style.top]="(bubbleY + 54) + 'px'"
          >
            @if (guidance === 'higher') { ↑ Higher }
            @if (guidance === 'lower') { ↓ Lower }
          </div>
          }
          } @else if (isActive && !targetNote) {
          <div class="game-idle">Get ready...</div>
          }
          @if (!isActive) {
          <div class="game-idle">Start singing to play</div>
          }
        </div>

        <!-- Score (logged-in only) -->
        @if (authService.currentUser && isActive) {
        <div class="score-row">
          <span class="score-item">✓ {{ correctCount }}/{{ totalCount }}</span>
          <span class="score-divider"></span>
          <span class="score-item">Streak {{ streak }}</span>
        </div>
        }
```

Also add `#gameArea` template reference — add `ViewChild` import and property. Add to imports:

```typescript
import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, inject, ViewChild, ElementRef } from '@angular/core';
```

And add this property to the class:

```typescript
  @ViewChild('gameArea', { static: false }) set gameAreaRef(el: ElementRef<HTMLElement>) {
    if (el) this.gameAreaEl = el.nativeElement;
  }
```

- [ ] **Remove the note grid styles and add game styles to `sing.page.scss`**

Replace the entire "Note Grid" section (lines 154-194) with:

```scss
// ── Bubble Game Area ──────────────────────────────────────
.game-area {
  position: relative;
  width: 100%;
  height: 200px;
  background: var(--swara-bg-card);
  border-radius: $radius-lg;
  border: 1px solid var(--swara-border);
  overflow: hidden;
}

.game-idle {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  color: var(--swara-text-tertiary);
}

.bubble {
  position: absolute;
  width: 100px;
  height: 44px;
  border-radius: $radius-full;
  background: var(--swara-gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(var(--swara-primary-rgb), 0.5);
  z-index: 2;
  transition: none;
  will-change: transform;

  &.popping {
    animation: bubble-pop 0.4s ease forwards;
  }
}

.bubble-note {
  font-size: 16px;
  font-weight: 800;
  color: white;
  font-family: var(--swara-font-display);
  letter-spacing: 0.03em;
}

.guidance {
  position: absolute;
  font-size: 12px;
  font-weight: 700;
  color: var(--swara-text-secondary);
  font-family: var(--swara-font-display);
  z-index: 1;
  pointer-events: none;
  animation: guidance-fade 0.6s ease infinite alternate;

  &.guidance-up { color: #FFD54F; }
  &.guidance-down { color: #5E81F4; }
}

.score-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-3;
  padding: $spacing-2 0;
}

.score-item {
  font-size: 14px;
  font-weight: 700;
  color: var(--ion-color-success);
  font-family: var(--swara-font-mono);
}

.score-divider {
  width: 1px;
  height: 16px;
  background: var(--swara-border);
}

// ── Keyframes ─────────────────────────────────────────────
@keyframes bubble-pop {
  0%   { transform: scale(1); opacity: 1; }
  40%  { transform: scale(1.4); opacity: 0.8; }
  100% { transform: scale(0); opacity: 0; }
}

@keyframes guidance-fade {
  0%   { opacity: 0.5; transform: translateY(0); }
  100% { opacity: 1; transform: translateY(-4px); }
}
```

---

### Task 3: Verify Build

- [ ] **Run type check**

```bash
npx tsc --noEmit --project apps/mobile-app/tsconfig.app.json 2>&1
```

Expected: No errors.

- [ ] **Commit changes**

```bash
git add apps/mobile-app/src/app/pages/sing/sing.page.ts apps/mobile-app/src/app/pages/sing/sing.page.scss
git commit -m "feat(sing): replace note grid with bouncing bubble game"
```