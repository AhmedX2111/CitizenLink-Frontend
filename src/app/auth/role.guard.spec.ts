/*
 * RoleGuard spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - allows navigation when no roles are configured on the route
 *   - allows navigation when the user holds one of the allowed roles
 *   - ADMIN users can access admin-only routes (/app/users)
 *   - ADMIN/SUPERVISOR can access supervisor routes (/reports)
 *   - regular (non-admin) users are blocked from admin routes
 *   - blocked users are redirected to the /forbidden (403) page
 *
 * SKIPPED (with reason):
 *   - JWT role fallback: RoleGuard delegates role checks to AuthUserService.hasRoleAny,
 *     which is covered in auth-user.service.spec.ts.
 *   - Reactive role display in the UI: covered by sidebar.spec.ts (authState$ signal).
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

  it('allows an ADMIN user to access an admin-only route', () => {
    authUser.hasRoleAny.mockReturnValue(true);
    const route = { data: { roles: ['ADMIN'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows an ADMIN or SUPERVISOR user to access a supervisor route', () => {
    authUser.hasRoleAny.mockImplementation(roles => roles.includes('ADMIN') || roles.includes('SUPERVISOR'));
    const route = { data: { roles: ['ADMIN', 'SUPERVISOR'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(true);
  });

  it('blocks a regular user from an admin route and redirects to /forbidden', () => {
    const route = { data: { roles: ['ADMIN'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(false);
    expect(authUser.hasRoleAny).toHaveBeenCalledWith(['ADMIN']);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
  });

  it('blocks a HANDLER from a supervisor route and redirects to /forbidden', () => {
    const route = { data: { roles: ['ADMIN', 'SUPERVISOR'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
  });

  it('redirects to /forbidden on every denial', () => {
    const route = { data: { roles: ['ADMIN'] } } as unknown as ActivatedRouteSnapshot;

    expect(guard.canActivate(route)).toBe(false);
    expect(guard.canActivate(route)).toBe(false);
    expect(router.navigate).toHaveBeenCalledTimes(2);
    expect(router.navigate).toHaveBeenCalledWith(['/forbidden']);
  });
});
