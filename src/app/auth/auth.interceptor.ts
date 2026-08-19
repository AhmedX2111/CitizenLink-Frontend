import { HttpInterceptorFn, HttpRequest, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { AuthTokenService } from './auth-token.service';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

function addAuthHeader(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

/**
 * True when the request targets the backend API: any relative URL (same origin,
 * which is how production works with apiUrl = '') or an absolute URL that
 * starts with the configured API base. Absolute URLs to other hosts (CDNs,
 * analytics, map tiles) are never treated as API calls.
 */
function isApiRequest(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }
  return environment.apiUrl.length > 0 && url.startsWith(environment.apiUrl);
}

/**
 * Normalises a request URL to the API path. Absolute URLs on the API base have
 * the base stripped; relative URLs and any other host are returned unchanged,
 * so a path-only check can never match a third-party host.
 */
function apiPath(url: string): string {
  return url.startsWith(environment.apiUrl) ? url.slice(environment.apiUrl.length) : url;
}

function isPublicAuthRoute(url: string): boolean {
  const path = apiPath(url);
  return path === '/api/v1/auth/login' || path === '/api/v1/auth/refresh'
      || path.startsWith('/api/v1/auth/login/') || path.startsWith('/api/v1/auth/refresh/');
}

function isLogoutRoute(url: string): boolean {
  const path = apiPath(url);
  return path === '/api/v1/auth/logout' || path.startsWith('/api/v1/auth/logout/');
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(AuthTokenService);
  const authService = inject(AuthService);

  if (isPublicAuthRoute(req.url)) {
    return next(req);
  }

  const accessToken = tokenService.getToken();
  let authReq = req;

  if (accessToken && isApiRequest(req.url)) {
    authReq = addAuthHeader(req, accessToken);
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isLogoutRoute(req.url) || !isApiRequest(req.url)) {
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        switchMap((res) => {
          if (!res.token) {
            return throwError(() => error);
          }
          return next(addAuthHeader(req, res.token));
        }),
        catchError(() => {
          authService.forceLogout();
          return throwError(() => error);
        })
      );
    })
  );
};
