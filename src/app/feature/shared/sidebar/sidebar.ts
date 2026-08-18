import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../auth/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule,],
  templateUrl: './sidebar.html'
})
export class SidebarComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  currentUser = toSignal(this.authService.authState$);

  logout(): void {
    this.authService.logout();
  }

  createNewCase(): void {
    this.router.navigate(['/cases'], { queryParams: { tab: 'create' } });
  }
}