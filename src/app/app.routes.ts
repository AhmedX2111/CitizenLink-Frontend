import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/login/login.component').then(m => m.LoginComponent)
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
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' }
];