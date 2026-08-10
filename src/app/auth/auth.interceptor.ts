import { HttpInterceptorFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function isPublicAuthRoute(url: string): boolean {
  return /\/auth\/(login|refresh)$/i.test(url);
}

function isLogoutRoute(url: string): boolean {
  return /\/auth\/logout$/i.test(url);
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(AuthTokenService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (isPublicAuthRoute(req.url)) {
    return next(req);
  }

  const accessToken = tokenService.getToken();
  let authReq = req;

  if (accessToken) {
    authReq = addAuthHeader(req, accessToken);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isLogoutRoute(req.url)) {
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((res) => {
          if (!res.token) {
            return throwError(() => error);
          }
          const newToken = tokenService.getToken();
          return next(addAuthHeader(req, newToken ?? ''));
        }),
        catchError(() => {
          tokenService.clearAuthData();
          router.navigate(['/login']);
          return throwError(() => error);
        })
      );
    })
  );
};
