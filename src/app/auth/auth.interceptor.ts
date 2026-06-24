// src/app/auth/auth.interceptor.ts

import { Injectable, inject } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.authService.getToken();
    let authReq = req;

    // Don't add token to login request
    if (token && !req.url.includes('/auth/login')) {
      authReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(authReq).pipe(
      catchError((error: HttpErrorResponse) => {
        // Only redirect for 401 on non-login requests
        const isLoginRequest = req.url.includes('/auth/login');
        
        if (error.status === 401 && !isLoginRequest) {
          console.log('Unauthorized request, redirecting to login');
          this.authService.logout();
          // Don't navigate here - logout already navigates
        }
        
        return throwError(() => error);
      })
    );
  }
}