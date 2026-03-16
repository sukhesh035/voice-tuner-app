import {
  ChangeDetectionStrategy, ChangeDetectorRef,
  Component, OnDestroy, OnInit, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule }   from '@angular/forms';
import { Router }        from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon,
  IonChip, IonBadge, IonSpinner, IonInput, IonBackButton, IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { copyOutline, stopCircleOutline } from 'ionicons/icons';
import { HttpClient }    from '@angular/common/http';
import { Subject, interval, takeUntil } from 'rxjs';
import { AuthService }   from '@voice-tuner/auth';
import { generateSessionCode } from '@voice-tuner/shared-utils';
import { environment }   from '../../../environments/environment';
import { AnalyticsService } from '../../core/services/analytics.service';

interface StudentResult {
  studentId:   string;
  studentName: string;
  joinedAt:    string;
  score?:      number;
  accuracy?:   number;
  submitted:   boolean;
}

interface ClassroomSession {
  sessionCode:  string;
  teacherId:    string;
  key:          string;
  tempo:        number;
  raagaId?:     string;
  isActive:     boolean;
  studentCount: number;
  expiresAt:    string;
}

type ClassroomView = 'join' | 'teacher' | 'student-waiting' | 'student-active';

@Component({
  selector: 'app-classroom',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonChip, IonBadge, IonSpinner, IonInput, IonBackButton, IonButtons],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>{{ viewTitle }}</ion-title>
        <ion-buttons slot="end" *ngIf="currentView === 'teacher' && session">
          <ion-chip [color]="session.isActive ? 'success' : 'medium'">
            {{ session.isActive ? 'LIVE' : 'ENDED' }}
          </ion-chip>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">

      <!-- ─── Join View ───────────────────────────────────────────────── -->
      <ng-container *ngIf="currentView === 'join'">
        <div class="sruti-card" style="text-align:center; padding:2rem;">
          <div style="font-size:3rem; margin-bottom:1rem;">🎵</div>
          <h2 style="margin-bottom:0.5rem;">Join a Class</h2>
          <p style="color:var(--sruti-text-muted); margin-bottom:2rem;">
            Enter the session code from your Guru
          </p>
          <ion-input
            [(ngModel)]="joinCode"
            placeholder="e.g. YAMAN-X7"
            fill="outline"
            style="margin-bottom:1rem; text-transform:uppercase; letter-spacing:0.1em;"
            (ionInput)="joinCode = joinCode.toUpperCase()"
          ></ion-input>
          <ion-input
            [(ngModel)]="studentName"
            placeholder="Your name"
            fill="outline"
            style="margin-bottom:1.5rem;"
          ></ion-input>
          <ion-button expand="block" [disabled]="!joinCode || !studentName || joining" (click)="joinSession()">
            <ion-spinner *ngIf="joining" name="crescent" slot="start"></ion-spinner>
            {{ joining ? 'Joining…' : 'Join Session' }}
          </ion-button>
          <div *ngIf="joinError" style="color:var(--sruti-error); margin-top:1rem;">
            {{ joinError }}
          </div>
        </div>
      </ng-container>

      <!-- ─── Teacher View ────────────────────────────────────────────── -->
      <ng-container *ngIf="currentView === 'teacher' && session">
        <!-- Code Display -->
        <div class="sruti-card" style="text-align:center; margin-bottom:1rem;">
          <p style="color:var(--sruti-text-muted); margin-bottom:0.5rem;">Session Code</p>
          <div class="session-code-display">{{ session.sessionCode }}</div>
          <p style="font-size:0.8rem; color:var(--sruti-text-muted); margin-top:0.5rem;">
            Expires {{ expiresIn }}
          </p>
          <div style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem;">
            <ion-button fill="outline" size="small" (click)="copyCode()">
              <ion-icon name="copy-outline" slot="start"></ion-icon>
              Copy
            </ion-button>
            <ion-button fill="outline" size="small" color="danger" (click)="endSession()">
              <ion-icon name="stop-circle-outline" slot="start"></ion-icon>
              End Session
            </ion-button>
          </div>
        </div>

        <!-- Session Config Badge -->
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap; margin-bottom:1rem;">
          <ion-chip>Key: {{ session.key }}</ion-chip>
          <ion-chip>BPM: {{ session.tempo }}</ion-chip>
          <ion-chip *ngIf="session.raagaId">{{ session.raagaId }}</ion-chip>
          <ion-chip color="success">{{ students.length }} students</ion-chip>
        </div>

        <!-- Student List -->
        <div class="sruti-card" style="padding:0;">
          <div style="padding:1rem; border-bottom:1px solid var(--sruti-border);">
            <strong>Students</strong>
          </div>
          <div *ngFor="let s of students" style="padding:0.875rem 1rem; border-bottom:1px solid var(--sruti-border); display:flex; align-items:center; justify-content:space-between;">
            <div>
              <div>{{ s.studentName }}</div>
              <div style="font-size:0.75rem; color:var(--sruti-text-muted);">
                Joined {{ s.joinedAt | date:'shortTime' }}
              </div>
            </div>
            <div *ngIf="s.submitted" style="text-align:right;">
              <div style="font-size:1.2rem; font-weight:700; color:var(--sruti-primary);">
                {{ s.score }}
              </div>
              <div style="font-size:0.75rem; color:var(--sruti-text-muted);">
                {{ s.accuracy | number:'1.0-0' }}% accuracy
              </div>
            </div>
            <ion-badge *ngIf="!s.submitted" color="warning">Practicing</ion-badge>
          </div>
          <div *ngIf="students.length === 0" style="padding:2rem; text-align:center; color:var(--sruti-text-muted);">
            Waiting for students to join…
          </div>
        </div>
      </ng-container>

      <!-- ─── Student Waiting ─────────────────────────────────────────── -->
      <ng-container *ngIf="currentView === 'student-waiting'">
        <div style="text-align:center; padding:3rem 1rem;">
          <ion-spinner name="dots" style="transform:scale(2); margin-bottom:2rem;"></ion-spinner>
          <h3>Waiting for session to start…</h3>
          <p style="color:var(--sruti-text-muted);">
            Session code: <strong>{{ joinCode }}</strong>
          </p>
        </div>
      </ng-container>

    </ion-content>
  `,
  styles: [`
    .session-code-display {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: 0.2em;
      color: var(--sruti-primary);
      font-family: var(--font-mono, monospace);
    }
  `],
})
export class ClassroomPage implements OnInit, OnDestroy {
  private http      = inject(HttpClient);
  private auth      = inject(AuthService);
  private router    = inject(Router);
  private cdr       = inject(ChangeDetectorRef);
  private analytics = inject(AnalyticsService);
  private destroy$  = new Subject<void>();

  constructor() {
    addIcons({ copyOutline, stopCircleOutline });
  }

  currentView: ClassroomView = 'join';
  session: ClassroomSession | null = null;
  students: StudentResult[] = [];
  joinCode     = '';
  studentName  = '';
  joining      = false;
  joinError    = '';
  expiresIn    = '';

  private pollInterval$ = new Subject<void>();

  get viewTitle(): string {
    const map: Record<ClassroomView, string> = {
      'join':            'Join Class',
      'teacher':         'Classroom',
      'student-waiting': 'Waiting…',
      'student-active':  'Session',
    };
    return map[this.currentView];
  }

  ngOnInit() {
    // Check route state — if navigated from Guru page with code, switch to teacher view
    const nav = this.router.getCurrentNavigation();
    const code = nav?.extras?.state?.['sessionCode'] as string | undefined;
    if (code) {
      this.joinCode = code;
      this.loadTeacherView(code);
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async joinSession() {
    this.joining   = true;
    this.joinError = '';
    const token = await this.auth.getIdToken();
    this.http.post<{ key: string; tempo: number; raagaId: string }>(
      `${environment.apiBaseUrl}/classroom/join`,
      { sessionCode: this.joinCode, studentName: this.studentName },
      { headers: { Authorization: `Bearer ${token}` } },
    ).subscribe({
      next: (res) => {
        this.currentView = 'student-waiting';
        this.joining     = false;
        this.analytics.logEvent('classroom_joined', { session_code: this.joinCode });
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.joinError = err.error?.error ?? 'Failed to join session';
        this.joining   = false;
        this.cdr.markForCheck();
      },
    });
  }

  private async loadTeacherView(code: string) {
    const token = await this.auth.getIdToken();
    this.http.get<{ session: ClassroomSession; students: StudentResult[] }>(
      `${environment.apiBaseUrl}/classroom/sessions/${code}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).subscribe({
      next: ({ session, students }) => {
        this.session     = session;
        this.students    = students;
        this.currentView = 'teacher';
        this.updateExpiresIn();
        this.startPolling(code);
        this.cdr.markForCheck();
      },
    });
  }

  private startPolling(code: string) {
    interval(5000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.loadTeacherView(code));
  }

  private updateExpiresIn() {
    if (!this.session) return;
    const diff = new Date(this.session.expiresAt).getTime() - Date.now();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    this.expiresIn = `in ${h}h ${m}m`;
  }

  async copyCode() {
    if (this.session) {
      await navigator.clipboard.writeText(this.session.sessionCode);
    }
  }

  async endSession() {
    if (!this.session) return;
    const token = await this.auth.getIdToken();
    this.http.delete(
      `${environment.apiBaseUrl}/classroom/sessions/${this.session.sessionCode}`,
      { headers: { Authorization: `Bearer ${token}` } },
    ).subscribe(() => {
      this.analytics.logEvent('classroom_ended', {
        session_code:  this.session!.sessionCode,
        student_count: this.students.length,
      });
      this.router.navigate(['/home']);
    });
  }
}
