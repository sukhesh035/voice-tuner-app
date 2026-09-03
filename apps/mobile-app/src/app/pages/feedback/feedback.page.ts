import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonIcon
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubbleEllipses, checkmarkCircle, star, starOutline } from 'ionicons/icons';
import { AuthService } from '@voice-tuner/auth';
import { ApiService, FeedbackCategory, FeedbackPayload } from '../../core/services/api.service';
import { AnalyticsService } from '../../core/services/analytics.service';

const RATING_HINTS = ['', 'Needs work', 'Could be better', 'Good', 'Great', 'Excellent'];

@Component({
  selector: 'app-feedback',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon
  ],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Give Feedback</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="feedback-page">

        @if (submitted) {
          <div class="success-card swara-card">
            <ion-icon name="checkmark-circle" class="success-icon"></ion-icon>
            <div class="success-title">Thank you!</div>
            <div class="success-sub">Your feedback helps us make Swara AI better.</div>
            <button class="swara-btn swara-btn--primary success-btn" (click)="done()">Done</button>
          </div>
        } @else {
          <div class="swara-card fb-card">

            <div class="fb-intro">
              <ion-icon name="chatbubble-ellipses" class="fb-intro-icon"></ion-icon>
              <div>
                <div class="fb-intro-title">We'd love to hear from you</div>
                <div class="fb-intro-sub">Spot a bug, missing a feature, or just want to say hi?</div>
              </div>
            </div>

            <!-- Category -->
            <div class="fb-group">
              <div class="fb-label">Category</div>
              <div class="fb-chips" role="group" aria-label="Feedback category">
                @for (c of categories; track c.value) {
                  <button
                    type="button"
                    class="fb-chip"
                    [class.selected]="category === c.value"
                    (click)="setCategory(c.value)"
                  >{{ c.label }}</button>
                }
              </div>
            </div>

            <!-- Rating -->
            <div class="fb-group">
              <div class="fb-label">Rating</div>
              <div class="fb-stars" role="group" aria-label="Star rating">
                @for (n of starValues; track n) {
                  <button
                    type="button"
                    class="star-btn"
                    [class.on]="n <= rating"
                    (click)="setRating(n)"
                    [attr.aria-label]="n + (n === 1 ? ' star' : ' stars')"
                  >
                    <ion-icon [name]="n <= rating ? 'star' : 'star-outline'"></ion-icon>
                  </button>
                }
              </div>
              <div class="fb-hint">{{ rating ? ratingHint : 'Tap a star to rate' }}</div>
            </div>

            <!-- Name (optional) -->
            <div class="fb-group">
              <label class="fb-label" for="fb-name">Your name (optional)</label>
              <input
                id="fb-name"
                class="fb-input"
                type="text"
                [(ngModel)]="name"
                placeholder="Your name (optional)"
                autocomplete="name"
                maxlength="80"
              />
            </div>

            <!-- Message -->
            <div class="fb-group">
              <label class="fb-label" for="fb-message">Message</label>
              <textarea
                id="fb-message"
                class="fb-textarea"
                rows="5"
                [(ngModel)]="message"
                maxlength="2000"
                placeholder="Tell us more..."
              ></textarea>
              <div class="fb-count">{{ message.length }}/2000</div>
            </div>

            @if (errorMsg) {
              <div class="fb-error">{{ errorMsg }}</div>
            }

            <button
              class="swara-btn swara-btn--primary fb-submit"
              [disabled]="!canSubmit"
              (click)="submit()"
            >
              {{ submitting ? 'Sending…' : 'Send Feedback' }}
            </button>

          </div>
        }

      </div>
    </ion-content>
  `,
  styleUrls: ['./feedback.page.scss']
})
export class FeedbackPage implements OnInit {
  readonly categories: { value: FeedbackCategory; label: string }[] = [
    { value: 'comment',    label: 'Comment' },
    { value: 'suggestion', label: 'Suggestion' },
    { value: 'problem',    label: 'Problem' },
  ];
  readonly starValues = [1, 2, 3, 4, 5];

  readonly authService = inject(AuthService);
  readonly api = inject(ApiService);
  readonly analytics = inject(AnalyticsService);
  readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly _icons = (() => addIcons({ chatbubbleEllipses, checkmarkCircle, star, starOutline }))();

  category: FeedbackCategory = 'comment';
  rating: number | null = null;
  name = '';
  message = '';
  submitting = false;
  submitted = false;
  errorMsg: string | null = null;

  ngOnInit(): void {
    const userName = this.authService.currentUser?.name;
    if (userName) this.name = userName;
  }

  get ratingHint(): string {
    return this.rating ? RATING_HINTS[this.rating] : '';
  }

  /** Submit is enabled only when a rating is chosen and the message has real content. */
  get canSubmit(): boolean {
    return this.rating !== null && this.message.trim().length > 0 && !this.submitting;
  }

  setCategory(category: FeedbackCategory): void {
    this.category = category;
  }

  setRating(n: number): void {
    this.rating = n;
  }

  async submit(): Promise<void> {
    if (!this.canSubmit) return;
    const payload: FeedbackPayload = {
      name: this.name.trim() || undefined,
      category: this.category,
      rating: this.rating as number,
      message: this.message.trim(),
    };
    this.submitting = true;
    this.errorMsg = null;
    this.cdr.markForCheck();
    try {
      await this.api.addFeedback(payload);
      this.analytics.logEvent('feedback_submitted', {
        category: payload.category,
        rating: payload.rating,
      });
      this.submitted = true;
    } catch (err) {
      console.error('[FeedbackPage] submit failed:', err);
      this.errorMsg = 'Could not send feedback. Please check your connection and try again.';
    } finally {
      this.submitting = false;
      this.cdr.markForCheck();
    }
  }

  done(): void {
    this.router.navigate(['/home']);
  }
}
