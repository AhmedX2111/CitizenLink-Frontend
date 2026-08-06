/*
 * RoleGuard spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - allows navigation when no roles are configured on the route
 *   - allows navigation when the user holds one of the allowed roles
 *   - redirects to /dashboard and blocks navigation otherwise
 *
 * SKIPPED (with reason):
 *   - JWT role fallback: RoleGuard delegates role checks to AuthUserService.hasRoleAny,
 *     which is covered in auth-user.service.spec.ts.
 */

import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router } from '@angular/router';

import { RoleGuard } from './role.guard';
import { AuthUserService } from './auth-user.service';

describe('RoleGuard', () => {
  let guard: RoleGuard;
  let authUser: { hasRoleAny: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    authUser = { hasRoleAny: vi.fn().mockReturnValue(false) };
    router = { navigate: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        RoleGuard,
        { provide: AuthUserService, useValue: authUser },
        { provide: Router, useValue: router }
      ]
    });

    guard = TestBed.inject(RoleGuard);
  });

  it('should be created', () => {
    expect(guard).toBeTruthy();
  });

  it('allows navigation when the route defines no roles', () => {
    const route = { data: {} } as unknown as ActivatedRouteSnapshot;
    expect(guard.canActivate(route)).toBe(true);
    expect(authUser.hasRoleAny).not.toHaveBeenCalled();
  });

  it('allows navigation when the route role list is empty', () => {
    const route = { data: { roles: [] } } as unknown as ActivatedRouteSnapshot;
    expect(guard.canActivate(route)).toBe(true);
    expect(authUser.hasRoleAny).not.toHaveBeenCalled();
  });

  it('allows navigation when the user holds an allowed role', () => {
    authUser.hasRoleAny.mockReturnValue(true);
    const route = { data: { roles: ['ADMIN', 'SUPERVISOR'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(true);
    expect(authUser.hasRoleAny).toHaveBeenCalledWith(['ADMIN', 'SUPERVISOR']);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('redirects to /dashboard and blocks navigation for an unauthorized user', () => {
    const route = { data: { roles: ['ADMIN'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });
});
