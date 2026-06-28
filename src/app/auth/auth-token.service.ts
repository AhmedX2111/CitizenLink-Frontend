import { Injectable, inject } from '@angular/core';
import { AuthResponse } from './models/auth.models';
import { LoggerService } from '../../core/services/logger.service';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';
  private readonly REMEMBER_ME_KEY = 'remember_me';
  private logger = inject(LoggerService);

  getToken(): string | null {
    const rememberMe = localStorage.getItem(this.REMEMBER_ME_KEY) === 'true';
    if (rememberMe) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return sessionStorage.getItem(this.TOKEN_KEY);
  }

  getUserData(): AuthResponse | null {
    const userData = localStorage.getItem(this.USER_KEY) || sessionStorage.getItem(this.USER_KEY);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  }

  saveAuthData(response: AuthResponse, rememberMe: boolean): void {
    this.clearAuthData();
    const storage = rememberMe ? localStorage : sessionStorage;
    if (response.token) {
      storage.setItem(this.TOKEN_KEY, response.token);
      storage.setItem(this.USER_KEY, JSON.stringify(response));
      storage.setItem(this.REMEMBER_ME_KEY, String(rememberMe));
      this.logger.info('AuthTokenService', `Auth data saved to ${rememberMe ? 'localStorage' : 'sessionStorage'}`);
    }
  }

  clearAuthData(): void {
    this.logger.info('AuthTokenService', 'Clearing all auth data from storage');
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.REMEMBER_ME_KEY);
    sessionStorage.removeItem(this.TOKEN_KEY);
    sessionStorage.removeItem(this.USER_KEY);
    sessionStorage.removeItem(this.REMEMBER_ME_KEY);
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiryDate = new Date(payload.exp * 1000);
      const isValid = expiryDate > new Date();
      if (!isValid) {
        this.clearAuthData();
      }
      return isValid;
    } catch {
      return false;
    }
  }
}
