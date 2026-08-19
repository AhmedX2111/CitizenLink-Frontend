/*
 * AuthUserService spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - hasRole / hasRoleAny against loaded user data
 *   - hasRoleAny with a null user -> false (safe guard)
 *   - getRoleFromToken: extracts the role claim from a valid JWT, null for missing role,
 *     malformed token, or absent token
 *   - getCurrentUser GETs /auth/me
 *
 * SKIPPED (with reason):
 *   - JWT signature verification: the frontend only reads claims, verification is server-side.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { AuthUserService } from './auth-user.service';
import { AuthTokenService } from './auth-token.service';
import { environment } from '../../environments/environment';

const AUTH_URL = `${environment.apiUrl}/api/v1/auth`;

function makeToken(payload: unknown): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

const adminUser = {
  token: 'jwt-1',
  id: 'u-1',
  username: 'admin',
  displayName: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN' as const
};

describe('AuthUserService', () => {
  let service: AuthUserService;
  let httpMock: HttpTestingController;
  let tokenService: {
    getUserData: ReturnType<typeof vi.fn>;
    getToken: ReturnType<typeof vi.fn>;
    userDataSignal: ReturnType<typeof signal<typeof adminUser | null>>;
  };

  beforeEach(() => {
    tokenService = {
      getUserData: vi.fn().mockReturnValue(null),
      getToken: vi.fn().mockReturnValue(null),
      userDataSignal: signal<typeof adminUser | null>(null)
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthTokenService, useValue: tokenService }
      ]
    });

    service = TestBed.inject(AuthUserService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('hasRole', () => {
    it('returns true when the loaded user has the role', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(service.hasRole('ADMIN')).toBe(true);
    });

    it('returns false when the loaded user has a different role', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(service.hasRole('HANDLER')).toBe(false);
    });

    it('returns false when there is no loaded user', () => {
      expect(service.hasRole('ADMIN')).toBe(false);
    });
  });

  describe('hasRoleSignal', () => {
    it('returns a reactive signal that matches the loaded user role', () => {
      const roleSignal = service.hasRoleSignal('ADMIN');
      expect(roleSignal()).toBe(false);

      tokenService.userDataSignal.set(adminUser);

      expect(roleSignal()).toBe(true);
    });

    it('returns false for a different role', () => {
      tokenService.userDataSignal.set(adminUser);
      expect(service.hasRoleSignal('HANDLER')()).toBe(false);
    });
  });

  describe('hasRoleAny', () => {
    it('returns true when the loaded user matches one of the roles', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(service.hasRoleAny(['SUPERVISOR', 'ADMIN'])).toBe(true);
    });

    it('returns false when the loaded user matches none of the roles', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(service.hasRoleAny(['HANDLER'])).toBe(false);
    });

    it('returns false when there is no loaded user', () => {
      expect(service.hasRoleAny(['ADMIN'])).toBe(false);
    });
  });

  describe('getRoleFromToken', () => {
    it('extracts the role claim from a valid token', () => {
      tokenService.getToken.mockReturnValue(makeToken({ role: 'SUPERVISOR' }));
      expect(service.getRoleFromToken()).toBe('SUPERVISOR');
    });

    it('returns null when the token has no role claim', () => {
      tokenService.getToken.mockReturnValue(makeToken({ exp: 9999999999 }));
      expect(service.getRoleFromToken()).toBeNull();
    });

    it('returns null for a malformed token', () => {
      tokenService.getToken.mockReturnValue('not-a-jwt');
      expect(service.getRoleFromToken()).toBeNull();
    });

    it('returns null when there is no token', () => {
      expect(service.getRoleFromToken()).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('GETs the current user from /auth/me', () => {
      service.getCurrentUser().subscribe(user => {
        expect(user).toEqual(adminUser);
      });

      const req = httpMock.expectOne({ method: 'GET', url: `${AUTH_URL}/me` });
      req.flush(adminUser);
    });
  });
});
