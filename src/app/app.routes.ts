import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.Login)
  },
  {
    path: 'logout',
    loadComponent: () =>
      import('./auth/logout/logout.component').then(m => m.Logout)
  },
  {
    path: 'cases',
    loadComponent: () =>
      import('./feature/cases/cases').then(m => m.CasesComponent),
    canActivate: [AuthGuard]
  },
  // Placeholder — replace with real dashboard component when built
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./feature/cases/cases').then(m => m.CasesComponent),
    canActivate: [AuthGuard]
  },
  // US-07: Call Center - Citizen Search
  {
    path: 'app/call-center',
    loadComponent: () =>
      import('./call-center/call-center/call-center').then(m => m.CallCenter),
    canActivate: [AuthGuard]
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];