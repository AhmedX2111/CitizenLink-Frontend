import {
  Component, OnInit, signal, computed, inject, DestroyRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserAdminService } from '../../../core/services/user-admin.service';
import { UserResponse } from '../../../core/models/user.models';
import { PagedResponse } from '../../../core/models/case.models';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  templateUrl: './user-list.html',
  styleUrl:    './user-list.css'
})
export class UserListComponent implements OnInit {

  private userService = inject(UserAdminService);
  private destroyRef  = inject(DestroyRef);
  private transloco   = inject(TranslocoService);

  // ── Filter state ──────────────────────────────────────────────
  filterRole   = '';
  filterActive = '';

  readonly roles   = ['ADMIN', 'SUPERVISOR', 'HANDLER', 'AGENT'];
  readonly statuses = [
    { label: 'All Statuses', value: '' },
    { label: 'Active',       value: 'true' },
    { label: 'Inactive',     value: 'false' }
  ];

  // ── List state ────────────────────────────────────────────────
  isLoading     = signal(false);
  loadError     = signal<string | null>(null);
  users         = signal<UserResponse[]>([]);
  totalElements = signal(0);
  totalPages    = signal(0);
  currentPage   = signal(0);
  pageSize      = 20;

  get pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.userService.getUsers(
      this.filterRole,
      this.filterActive,
      this.currentPage(),
      this.pageSize
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (res: PagedResponse<UserResponse>) => {
        this.users.set(res.content);
        this.totalElements.set(res.totalElements);
        this.totalPages.set(res.totalPages);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.loadError.set(
          err.status === 403
            ? this.transloco.translate('admin.users.errors.forbidden')
            : this.transloco.translate('admin.users.errors.loadFailed')
        );
      }
    });
  }

  applyFilter(): void {
    this.currentPage.set(0);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;
    this.currentPage.set(page);
    this.load();
  }

  // ── Helpers ───────────────────────────────────────────────────
  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  }

  roleBadgeClass(role: string): string {
    const map: Record<string, string> = {
      ADMIN:      'bg-primary text-on-primary',
      SUPERVISOR: 'bg-primary-container text-on-primary-container',
      HANDLER:    'bg-secondary-container text-on-secondary-container',
      AGENT:      'bg-surface-container-high text-on-surface',
    };
    return map[role] ?? 'bg-surface-container text-on-surface';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}