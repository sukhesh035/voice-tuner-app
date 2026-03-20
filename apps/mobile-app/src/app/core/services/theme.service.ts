import { Injectable } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private currentTheme: AppTheme = 'dark';

  initialize(): void {
    const saved = localStorage.getItem('swara-theme') as AppTheme | null;
    // Default to dark — the app is designed dark-first.
    // Only respect a saved preference, not the system setting.
    this.setTheme(saved ?? 'dark');
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    // Keep Ionic's own dark-palette class in sync so Ionic components
    // (which use shadow DOM and ignore data-theme) also render correctly.
    document.documentElement.classList.toggle('ion-palette-dark', theme === 'dark');
    localStorage.setItem('swara-theme', theme);
  }

  toggleTheme(): void {
    this.setTheme(this.currentTheme === 'dark' ? 'light' : 'dark');
  }

  get theme(): AppTheme { return this.currentTheme; }
  get isDark(): boolean { return this.currentTheme === 'dark'; }
}
