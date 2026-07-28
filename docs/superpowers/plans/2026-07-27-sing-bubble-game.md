# Sing Page — Note Bubble Game Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static "Notes Detected" grid on the Sing page with an interactive bubble game where notes bounce around and pop when sung correctly.

**Architecture:** CSS + requestAnimationFrame hybrid — bubble position via `requestAnimationFrame`, pop animation via CSS `@keyframes`. Tokens for guidance arrows (go higher/lower) and score display.

**Tech Stack:** Angular standalone, Ionic standalone, Web Audio API (existing), CSS keyframes

---

### Task 1: Add Game State and Animation Logic

**Files:**
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.ts`

- [ ] **Add game state properties** after the existing `sessionStats`:

```typescript
  // ── Game state ──
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

- [ ] **Add ViewChild setter** for the game area element:

```typescript
  @ViewChild('gameArea', { static: false }) set gameAreaRef(el: ElementRef<HTMLElement>) {
    if (el) this.gameAreaEl = el.nativeElement;
  }
```

- [ ] **Add game methods** after `updateScaleNoteSet()`:

```typescript
  private pickRandomNote(): void {
    const scaleNotes = Array.from(this.scaleNoteSet);
    if (scaleNotes.length === 0) return;
    const idx = Math.floor(Math.random() * scaleNotes.length);
    this.targetNote = scaleNotes[idx];
    this.guidance = '';
    this.spawnBubble();
  }

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

- [ ] **Update pitch subscription in `ngOnInit`** to add game logic:

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

- [ ] **Reset game state on start** — in `toggleMic()` else branch, after `this.detectedNotes.clear()`:

```typescript
        this.correctCount = 0;
        this.totalCount = 0;
        this.streak = 0;
        this.isPopping = false;
```

And after `this.isActive = true;` add:

```typescript
        this.pickRandomNote();
```

- [ ] **Reset game state on stop** — in `toggleMic()` if branch and `ionViewWillLeave()`:

After `this.isActive = false;` in both:

```typescript
      this.stopBounceLoop();
      this.targetNote = null;
      this.guidance = '';
      this.isPopping = false;
```

---

### Task 2: Replace Template and Add Styles

**Files:**
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.ts` — replace note grid template
- Modify: `apps/mobile-app/src/app/pages/sing/sing.page.scss` — add game styles

- [ ] **Replace the "Notes Detected" grid** with the game area + score:

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

- [ ] **Add game styles to `sing.page.scss`** — replace the note-grid-section block:

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