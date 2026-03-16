import { Routes } from '@angular/router';
import { authGuard } from '@voice-tuner/auth';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./tabs/tabs.component').then(m => m.TabsComponent),
    children: [
      {
        path: 'home',
        loadComponent: () => import('./pages/home/home.page').then(m => m.HomePage)
      },
      {
        path: 'tanpura',
        loadComponent: () => import('./pages/tanpura/tanpura.page').then(m => m.TanpuraPage)
      },
      {
        path: 'sing',
        loadComponent: () => import('./pages/sing/sing.page').then(m => m.SingPage)
      },
      {
        path: 'practice',
        loadComponent: () => import('./pages/practice/practice.page').then(m => m.PracticePage)
      },
      {
        path: 'progress',
        loadComponent: () => import('./pages/progress/progress.page').then(m => m.ProgressPage),
        canActivate: [authGuard]
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/settings/settings.page').then(m => m.SettingsPage)
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile.page').then(m => m.ProfilePage)
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login.page').then(m => m.LoginPage)
  },
  {
    path: 'classroom/:code',
    loadComponent: () => import('./pages/classroom/classroom.page').then(m => m.ClassroomPage)
  },
  {
    path: 'session-report/:id',
    loadComponent: () => import('./pages/session-report/session-report.page').then(m => m.SessionReportPage)
  },
  {
    path: 'privacy-policy',
    loadComponent: () => import('./pages/privacy-policy/privacy-policy.page').then(m => m.PrivacyPolicyPage)
  },
  {
    path: 'terms-of-service',
    loadComponent: () => import('./pages/terms-of-service/terms-of-service.page').then(m => m.TermsOfServicePage)
  },
  { path: '**', redirectTo: '' }
];
