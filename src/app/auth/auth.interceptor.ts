import { HttpInterceptorFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { throwError, Subject } from 'rxjs';
import { catchError, switchMap, take } from 'rxjs/operators';
import { AuthTokenService } from './auth-token.service';
import { HttpClient } from '@angular/common/http';
import { AuthResponse } from './models/auth.models';
import { environment } from '../../environments/environment';

let isRefreshing = false;
let refreshSubject: Subject<AuthResponse | null> | null = null;

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
  const router = inject(Router);
  const http = inject(HttpClient);

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

      if (!isRefreshing) {
        isRefreshing = true;
        refreshSubject = new Subject<AuthResponse | null>();

        http.post<AuthResponse>(
          `${environment.apiUrl}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        ).subscribe({
          next: (res) => {
            if (res.token) {
              tokenService.saveToken(res.token);
            }
            refreshSubject?.next(res);
            refreshSubject?.complete();
            refreshSubject = null;
            isRefreshing = false;
          },
          error: () => {
            refreshSubject?.next(null);
            refreshSubject?.complete();
            refreshSubject = null;
            isRefreshing = false;
            tokenService.clearAuthData();
            router.navigate(['/login']);
          }
        });
      }

      return (refreshSubject ?? new Subject<AuthResponse | null>()).pipe(
        take(1),
        switchMap(res => {
          if (!res) {
            return throwError(() => error);
          }
          const newToken = tokenService.getToken();
          return next(addAuthHeader(req, newToken ?? ''));
        })
      );
    })
  );
};
