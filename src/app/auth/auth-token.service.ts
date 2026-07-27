import { Injectable } from '@angular/core';
import { AuthResponse } from './models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private _token: string | null = null;
  private _user: AuthResponse | null = null;

  getToken(): string | null {
    return this._token;
  }

  getUserData(): AuthResponse | null {
    return this._user;
  }

  saveAuthData(response: AuthResponse): void {
    this._token = response.token;
    this._user = response;
  }

  saveToken(token: string): void {
    this._token = token;
  }

  clearAuthData(): void {
    this._token = null;
    this._user = null;
  }

  isAuthenticated(): boolean {
    return !!this._token;
  }
}
