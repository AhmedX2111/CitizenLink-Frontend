import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
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
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest, rememberMe: boolean): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => {
          this.tokenService.saveAuthData(response, rememberMe);
          this.authState.next(response);
        })
      );
  }

  logout(): void {
    this.http.post(`${this.API_URL}/logout`, {}).pipe(
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

  private loadStoredAuth(): void {
    const token = this.tokenService.getToken();
    const user = this.tokenService.getUserData();
    if (token && user && this.tokenService.isAuthenticated()) {
      this.authState.next(user);
    }
  }
}
