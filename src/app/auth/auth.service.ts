import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { LoginRequest, AuthResponse } from './models/auth.models';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly REMEMBER_ME_KEY = 'remember_me';
  
  private authState = new BehaviorSubject<AuthResponse | null>(null);
  authState$ = this.authState.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    this.loadStoredAuth();
  }

  login(credentials: LoginRequest, rememberMe: boolean): Observable<AuthResponse> {
    
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => {
          this.saveAuthData(response, rememberMe);
          this.authState.next(response);
        }),
        catchError(error => {
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    this.clearAuthData();
    this.authState.next(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
    if (rememberMe) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryDate = new Date(payload.exp * 1000);
      const isValid = expiryDate > new Date();
      
      if (!isValid) {
        this.logout();
      }
      return isValid;
    } catch {
      return false;
    }
  }

  getCurrentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.API_URL}/me`);
  }

  getUserData(): AuthResponse | null {
    const userData = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  }

  hasRole(role: string): boolean {
    const user = this.getUserData();
    return user?.role === role;
  }

  private saveAuthData(response: AuthResponse, rememberMe: boolean): void {
    const storage = rememberMe ? localStorage : sessionStorage;
    
    if (response.token) {
      storage.setItem(this.TOKEN_KEY, response.token);
      storage.setItem(this.USER_KEY, JSON.stringify(response));
      storage.setItem(this.REMEMBER_ME_KEY, String(rememberMe));
    }
  }

  private clearAuthData(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.REMEMBER_ME_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.REMEMBER_ME_KEY);
  }

  private loadStoredAuth(): void {
    const token = this.getToken();
    const user = this.getUserData();
    
    if (token && user && this.isAuthenticated()) {
      this.authState.next(user);
    }
  }
}