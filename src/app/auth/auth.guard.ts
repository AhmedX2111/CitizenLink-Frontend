import { Injectable, inject } from '@angular/core';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard {
  private tokenService = inject(AuthTokenService);
  private authService = inject(AuthService);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    if (this.tokenService.isAuthenticated()) {
      return of(true);
    }

    return this.authService.refreshSession().pipe(
      map(() => true),
      catchError(() => {
        this.authService.forceLogout(state.url);
        return of(false);
      })
    );
  }
}
