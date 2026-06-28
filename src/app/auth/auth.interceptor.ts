import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthTokenService } from './auth-token.service';
import { LoggerService } from '../../core/services/logger.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(AuthTokenService);
  const logger = inject(LoggerService);
  const router = inject(Router);

  const token = tokenService.getToken();
  let authReq = req;

  if (token && !req.url.includes('/auth/login')) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` }
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      const isLoginRequest = req.url.includes('/auth/login');

      if (error.status === 401 && !isLoginRequest) {
        logger.info('AuthInterceptor', 'Unauthorized request, redirecting to login');
        tokenService.clearAuthData();
        router.navigate(['/login']);
      }

      return throwError(() => error);
    })
  );
};
