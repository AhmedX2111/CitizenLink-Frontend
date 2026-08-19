import { Injectable, inject, computed, type Signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthResponse } from './models/auth.models';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthUserService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/auth`;
  private http = inject(HttpClient);
  private tokenService = inject(AuthTokenService);

  hasRole(role: string): boolean {
    const user = this.tokenService.getUserData();
    return user?.role === role;
  }

  hasRoleSignal(role: string): Signal<boolean> {
    return computed(() => this.tokenService.userDataSignal()?.role === role);
  }

  hasRoleAny(roles: string[]): boolean {
    const user = this.tokenService.getUserData();
    return !!user && roles.includes(user.role);
  }

  getRoleFromToken(): string | null {
    const token = this.tokenService.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role ?? null;
    } catch {
      return null;
    }
  }

  getCurrentUser(): Observable<AuthResponse> {
    return this.http.get<AuthResponse>(`${this.API_URL}/me`);
  }
}
