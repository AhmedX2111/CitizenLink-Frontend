import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthUserService } from './auth-user.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard {
  private authUser = inject(AuthUserService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const allowedRoles = route.data['roles'] as string[] | undefined;
    if (!allowedRoles || allowedRoles.length === 0) return true;

    if (this.authUser.hasRoleAny(allowedRoles)) return true;

    this.router.navigate(['/forbidden']);
    return false;
  }
}
