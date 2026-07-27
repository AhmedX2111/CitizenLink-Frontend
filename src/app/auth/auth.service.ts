import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of } from 'rxjs';
import { tap, finalize, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoginRequest, AuthResponse } from './models/auth.models';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/auth`;
  private http = inject(HttpClient);
  private router = inject(Router);
  private tokenService = inject(AuthTokenService);
  private logger = inject(LoggerService);

  private authState = new BehaviorSubject<AuthResponse | null>(null);
  authState$ = this.authState.asObservable();

  constructor() {
    this.tryRestoreSession();
  }

  private tryRestoreSession(): void {
    this.refreshSession().pipe(
      catchError(() => of(null))
    ).subscribe();
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials, {
      withCredentials: true
    }).pipe(
      tap(response => {
        this.tokenService.saveAuthData(response);
        this.authState.next(response);
      })
    );
  }

  refreshSession(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, {}, {
      withCredentials: true
    }).pipe(
      tap(res => {
        if (res.token) {
          this.tokenService.saveToken(res.token);
          if (res.displayName) {
            this.authState.next(res);
          }
        }
      })
    );
  }

  logout(): void {
    this.http.post(`${this.API_URL}/logout`, {}, { withCredentials: true }).pipe(
      finalize(() => {
        this.tokenService.clearAuthData();
        this.authState.next(null);
        this.router.navigate(['/Landing']);
      })
    ).subscribe({
      next: () => this.logger.info('AuthService', 'Logout successful'),
      error: (error) => this.logger.error('AuthService', 'Logout API error:', error)
    });
  }
}
