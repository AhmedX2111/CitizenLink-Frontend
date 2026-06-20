import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../auth/auth.service';
import { AuthResponse } from '../../../auth/models/auth.models';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css'
})
export class SidebarComponent implements OnInit {

  private authService = inject(AuthService);
  private destroyRef   = inject(DestroyRef);

  currentUser = signal<AuthResponse | null>(null);

  ngOnInit(): void {
    this.authService.authState$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(user => this.currentUser.set(user));
  }

  logout(): void {
    this.authService.logout();
  }
}