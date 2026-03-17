import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

// ── Response shapes (mirrors backend handler types) ──────────────────────────

export interface UserStats {
  totalSessions: number;
  totalMinutes:  number;
  currentStreak: number;
  longestStreak: number;
  overallScore:  number;
}

export interface UserPreferences {
  defaultKey:           string;
  defaultTempo:         number;
  pitchSensitivity:     number;
  theme:                'dark' | 'light';
  notificationsEnabled: boolean;
  dailyGoalMinutes:     number;
  instrument:           'tanpura' | 'keyboard' | 'guitar';
}

export interface UserProfile {
  userId:       string;
  email:        string;
  displayName:  string;
  createdAt:    string;
  stats:        UserStats;
  favoriteRagas: string[];
  preferences:  UserPreferences;
  photoUrl?:    string;
}

export interface StreaksResponse {
  streak:       number;         // current streak days
  practiceDays: string[];       // YYYY-MM-DD strings, newest first
  milestones:   number[];
}

export interface PracticeSession {
  sessionId:      string;
  createdAt:      string;
  duration:       number;       // seconds
  mode:           string;
  raagaId?:       string;
  key:            string;
  score:          number;
  avgAccuracy:    number;
}

export interface CreateSessionPayload {
  duration:       number;       // seconds
  mode:           string;
  raagaId?:       string;
  key:            string;
  score:          number;
  avgAccuracy:    number;
  stabilityScore: number;
  noteAccuracies: Record<string, number>;
  aiSummary?:     string;
}

export interface SessionsResponse {
  sessions:   PracticeSession[];
  nextCursor: string | null;
}

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  getProfile(): Promise<UserProfile> {
    return firstValueFrom(
      this.http.get<UserProfile>(`${this.base}/api/users/me`)
    );
  }

  getStreaks(): Promise<StreaksResponse> {
    return firstValueFrom(
      this.http.get<StreaksResponse>(`${this.base}/api/streaks`)
    );
  }

  getSessions(limit = 50): Promise<SessionsResponse> {
    return firstValueFrom(
      this.http.get<SessionsResponse>(`${this.base}/api/sessions`, {
        params: { limit: String(limit) }
      })
    );
  }

  checkin(durationMinutes: number, score?: number): Promise<{ currentStreak: number }> {
    return firstValueFrom(
      this.http.post<{ currentStreak: number }>(`${this.base}/api/streaks/checkin`, { durationMinutes, score })
    );
  }

  createSession(payload: CreateSessionPayload): Promise<{ sessionId: string; createdAt: string }> {
    return firstValueFrom(
      this.http.post<{ sessionId: string; createdAt: string }>(`${this.base}/api/sessions`, payload)
    );
  }

  updatePreferences(prefs: Partial<UserPreferences>): Promise<{ updated: boolean; updatedAt: string }> {
    return firstValueFrom(
      this.http.put<{ updated: boolean; updatedAt: string }>(`${this.base}/api/users/me`, { preferences: prefs })
    );
  }

  /** Get a presigned S3 upload URL for the user's profile photo. */
  getUploadUrl(contentType = 'image/jpeg'): Promise<{ uploadUrl: string; cdnUrl: string; key: string }> {
    return firstValueFrom(
      this.http.post<{ uploadUrl: string; cdnUrl: string; key: string }>(
        `${this.base}/api/users/me/upload-url`,
        { contentType },
      )
    );
  }

  /** Save the CDN photo URL to the user profile. */
  updatePhotoUrl(photoUrl: string): Promise<{ updated: boolean; updatedAt: string }> {
    return firstValueFrom(
      this.http.put<{ updated: boolean; updatedAt: string }>(`${this.base}/api/users/me`, { photoUrl })
    );
  }

  /** Register a push notification device token with the backend. */
  registerDeviceToken(token: string, platform: 'ios' | 'android'): Promise<{ registered: boolean }> {
    return firstValueFrom(
      this.http.post<{ registered: boolean }>(`${this.base}/api/users/me/device-token`, { token, platform })
    );
  }

  /** Remove a push notification device token from the backend. */
  deleteDeviceToken(token: string): Promise<{ deleted: boolean }> {
    return firstValueFrom(
      this.http.post<{ deleted: boolean }>(`${this.base}/api/users/me/device-token/remove`, { token })
    );
  }
}
