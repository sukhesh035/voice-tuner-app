import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import {
  IonHeader, IonToolbar, IonTitle, IonContent, IonSegment,
  IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { environment } from '../../../environments/environment';

interface ClassroomSession {
  sessionCode: string;
  raga:        string;
  saKey:       string;
  tempo:       number;
  duration:    number;
}

interface StudentResult {
  studentName: string;
  accuracy:    number;
  duration:    number;
  streakDays:  number;
  completed:   boolean;
}

@Component({
  selector: 'app-guru',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonSegment, IonSegmentButton, IonLabel
  ],
  templateUrl: './guru.page.html',
  styleUrls: ['./guru.page.scss'],
})
export class GuruPage implements OnInit {
  tab = 'create';
  isCreating = false;
  activeSession: ClassroomSession | null = null;

  readonly ragas = ['Yaman', 'Bhairav', 'Kalyani', 'Hamsadhwani', 'Todi', 'Bihag', 'Bhimpalasi'];
  readonly keys  = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

  newSession = { raga: 'Yaman', saKey: 'D', tempo: 60, duration: 10 };

  studentResults: StudentResult[] = [];

  get avgAccuracy(): number {
    if (!this.studentResults.length) return 0;
    return this.studentResults.reduce((s, r) => s + r.accuracy, 0) / this.studentResults.length;
  }

  get completedCount(): number {
    return this.studentResults.filter(r => r.completed).length;
  }

  constructor(private http: HttpClient, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.studentResults = [
      { studentName: 'Riya',  accuracy: 88, duration: 10, streakDays: 5,  completed: true  },
      { studentName: 'Arjun', accuracy: 72, duration: 8,  streakDays: 3,  completed: true  },
      { studentName: 'Meera', accuracy: 91, duration: 10, streakDays: 12, completed: true  },
      { studentName: 'Dev',   accuracy: 65, duration: 6,  streakDays: 1,  completed: false },
    ];
  }

  async createSession(): Promise<void> {
    this.isCreating = true;
    this.cdr.markForCheck();
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      this.activeSession = { ...this.newSession, sessionCode: code };
    } finally {
      this.isCreating = false;
      this.cdr.markForCheck();
    }
  }

  scoreColor(acc: number): string {
    if (acc >= 85) return 'var(--sruti-pitch-perfect)';
    if (acc >= 70) return 'var(--sruti-pitch-close)';
    return 'var(--sruti-pitch-off)';
  }
}
