import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';
import { LayoutComponent } from './feature/shared/layout/layout';

export const routes: Routes = [
  // Landing page - PUBLIC (no auth guard, no shared shell)
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./feature/landing/landing').then(m => m.LandingComponent)
  },
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

  // Authenticated shell — sidebar persists, only the page content swaps
  {
    path: '',
    component: LayoutComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./feature/dashboard/dashboard').then(m => m.DashboardComponent)
      },
      {
        path: 'cases',
        loadComponent: () =>
          import('./feature/cases/cases').then(m => m.CasesComponent)
      },
      {
        path: 'cases/:id',
        loadComponent: () =>
          import('./feature/cases/case-detail-page/case-detail-page').then(m => m.CaseDetailPageComponent)
      },
      {
        path: 'app/call-center',
        loadComponent: () =>
          import('./call-center/call-center/call-center').then(m => m.CallCenter)
      },
      {
        path: 'app/call-center/new-citizen',
        loadComponent: () =>
          import('./call-center/new-citizen/new-citizen/new-citizen').then(m => m.NewCitizen)
      },
      {
        path: 'app/call-center/citizen/:id',
        loadComponent: () =>
          import('./call-center/citizen-profile/citizen-profile').then(m => m.CitizenProfile)
      }
    ]
  },

  // Any other routes - redirect to landing page
  { path: '**', redirectTo: '' }
];