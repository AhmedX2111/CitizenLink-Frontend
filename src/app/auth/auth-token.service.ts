import { Injectable, signal } from '@angular/core';
import { AuthResponse } from './models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private _token: string | null = null;
  private _user: AuthResponse | null = null;
  private readonly userData = signal<AuthResponse | null>(null);
  readonly userDataSignal = this.userData.asReadonly();

  getToken(): string | null {
    return this._token;
  }

  getUserData(): AuthResponse | null {
    return this._user;
  }

  saveAuthData(response: AuthResponse): void {
    this._token = response.token;
    this._user = response;
    this.userData.set(response);
  }

  saveToken(token: string): void {
    this._token = token;
  }

  clearAuthData(): void {
    this._token = null;
    this._user = null;
    this.userData.set(null);
  }

  private getTokenExpiry(): number | null | 'malformed' {
    if (!this._token) return null;
    try {
      const parts = this._token.split('.');
      if (parts.length !== 3) return 'malformed';
      const payload = JSON.parse(atob(parts[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return 'malformed';
    }
  }

  isAuthenticated(): boolean {
    if (!this._token) return false;
    const expiry = this.getTokenExpiry();
    if (expiry === 'malformed') return false;
    if (expiry === null) return true;
    return Date.now() < expiry;
  }

  isTokenExpired(): boolean {
    if (!this._token) return true;
    const expiry = this.getTokenExpiry();
    if (expiry === 'malformed') return true;
    if (expiry === null) return false;
    return Date.now() >= expiry;
  }
}
