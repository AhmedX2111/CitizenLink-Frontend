import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { CaseSummary } from '../../../../core/models/citizen.models';

@Component({
  selector: 'app-case-history-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './case-history-modal.html',
  styleUrl: './case-history-modal.css'
})
export class CaseHistoryModalComponent {

  private transloco = inject(TranslocoService);

  @Input() isOpen        = false;
  @Input() isLoading     = false;
  @Input() loadError: string | null = null;
  @Input() cases: CaseSummary[] = [];
  @Input() currentPage   = 0;
  @Input() totalPages    = 0;
  @Input() totalElements = 0;
  @Input() pageSize      = 20;

  @Output() closed = new EventEmitter<void>();
  @Output() pageChanged = new EventEmitter<number>();
  @Output() openCase = new EventEmitter<string>();

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  goToPage(page: number): void {
    if (page < 0 || page >= this.totalPages) {
      return;
    }
    this.pageChanged.emit(page);
  }

  openCaseDetail(id: string): void {
    this.openCase.emit(id);
  }

  get pages(): number[] {
    return Array.from({ length: this.totalPages }, (_, i) => i);
  }

  departmentName(c: CaseSummary): string {
    return this.transloco.getActiveLang() === 'ar'
      ? (c.departmentNameAr || c.departmentNameEn || '—')
      : (c.departmentNameEn || c.departmentNameAr || '—');
  }

  statusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-800',
      'ASSIGNED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'AWAITING_INFO': 'bg-orange-100 text-orange-800',
      'SUSPENDED': 'bg-gray-100 text-gray-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-200 text-gray-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}