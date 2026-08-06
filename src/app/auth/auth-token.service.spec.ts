/*
 * AuthTokenService spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - saveAuthData stores both token and user identity
 *   - saveToken stores only the token
 *   - clearAuthData wipes both
 *   - isAuthenticated: no token / future exp / past exp / missing exp / malformed token
 *   - isTokenExpired: no token / future exp / past exp / missing exp / malformed token
 *
 * SKIPPED (with reason):
 *   - Persistent storage (localStorage): tokens are intentionally in-memory only
 *     by design; covered indirectly through the auth flows.
 */

import { AuthTokenService } from './auth-token.service';

function makeToken(payload: unknown): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('AuthTokenService', () => {
  let service: AuthTokenService;

  beforeEach(() => {
    service = new AuthTokenService();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('saveAuthData', () => {
    it('stores both the token and the user identity', () => {
      const user = {
        token: 'jwt-1',
        id: 'u-1',
        username: 'admin',
        displayName: 'Admin',
        email: 'admin@example.com',
        role: 'ADMIN' as const
      };

      service.saveAuthData(user);

      expect(service.getToken()).toBe('jwt-1');
      expect(service.getUserData()).toEqual(user);
    });
  });

  describe('saveToken', () => {
    it('stores only the token and leaves user data unchanged', () => {
      const user = {
        token: 'jwt-1',
        id: 'u-1',
        username: 'admin',
        displayName: 'Admin',
        email: 'admin@example.com',
        role: 'ADMIN' as const
      };
      service.saveAuthData(user);

      service.saveToken('jwt-2');

      expect(service.getToken()).toBe('jwt-2');
      expect(service.getUserData()).toEqual(user);
    });
  });

  describe('clearAuthData', () => {
    it('wipes both the token and the user identity', () => {
      service.saveAuthData({
        token: 'jwt-1',
        id: 'u-1',
        username: 'admin',
        displayName: 'Admin',
        email: 'admin@example.com',
        role: 'ADMIN' as const
      });

      service.clearAuthData();

      expect(service.getToken()).toBeNull();
      expect(service.getUserData()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when there is no token', () => {
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true when the token expires in the future', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      service.saveToken(makeToken({ exp }));
      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns false when the token has already expired', () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      service.saveToken(makeToken({ exp }));
      expect(service.isAuthenticated()).toBe(false);
    });

    it('returns true when the token has no exp claim', () => {
      service.saveToken(makeToken({ role: 'ADMIN' }));
      expect(service.isAuthenticated()).toBe(true);
    });

    it('returns false for a malformed token', () => {
      service.saveToken('not-a-jwt');
      expect(service.isAuthenticated()).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true when there is no token', () => {
      expect(service.isTokenExpired()).toBe(true);
    });

    it('returns false when the token expires in the future', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      service.saveToken(makeToken({ exp }));
      expect(service.isTokenExpired()).toBe(false);
    });

    it('returns true when the token has already expired', () => {
      const exp = Math.floor(Date.now() / 1000) - 3600;
      service.saveToken(makeToken({ exp }));
      expect(service.isTokenExpired()).toBe(true);
    });

    it('returns false when the token has no exp claim', () => {
      service.saveToken(makeToken({ role: 'ADMIN' }));
      expect(service.isTokenExpired()).toBe(false);
    });

    it('returns true for a malformed token', () => {
      service.saveToken('not-a-jwt');
      expect(service.isTokenExpired()).toBe(true);
    });
  });
});
