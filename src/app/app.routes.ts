// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
  },
//   {
//     path: 'dashboard',
//     loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
//     canActivate: [AuthGuard]
//   },
  {
    path: '',
    redirectTo: '/login',
    pathMatch: 'full'
  },
  {
    path: '**',
    redirectTo: '/login'
  }
];