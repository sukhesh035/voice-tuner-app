import { Injectable } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private currentTheme: AppTheme = 'dark';

  initialize(): void {
    const saved = localStorage.getItem('sruti-theme') as AppTheme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.setTheme(saved ?? (prefersDark ? 'dark' : 'light'));
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('sruti-theme', theme);
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  get theme(): AppTheme { return this.currentTheme; }
  get isDark(): boolean { return this.currentTheme === 'dark'; }
}
