import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { CaseResponse, CaseStatus, Priority, CaseType } from '../../../../core/models/case.models';

@Component({
  selector: 'app-case-detail-modal',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './case-detail-modal.html',
  styleUrl: './case-detail-modal.css'
})
export class CaseDetailModalComponent {

  @Input() isOpen        = false;
  @Input() isLoading     = false;
  @Input() loadError: string | null = null;
  @Input() caseDetail: CaseResponse | null = null;

  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onClose();
    }
  }

  statusBadgeClass(status: CaseStatus): string {
    const map: Record<CaseStatus, string> = {
      NEW:           'bg-blue-50 text-blue-700',
      ASSIGNED:      'bg-yellow-50 text-yellow-800',
      IN_PROGRESS:   'bg-indigo-50 text-indigo-700',
      AWAITING_INFO: 'bg-orange-50 text-orange-700',
      SUSPENDED:     'bg-gray-100 text-gray-600',
      RESOLVED:      'bg-emerald-50 text-emerald-700',
      CLOSED:        'bg-slate-100 text-slate-600',
      CANCELLED:     'bg-red-50 text-red-700',
    };
    return map[status] ?? 'bg-gray-100 text-gray-600';
  }

  priorityBadgeClass(priority: Priority): string {
    const map: Record<Priority, string> = {
      LOW:    'bg-emerald-50 text-emerald-700',
      MEDIUM: 'bg-yellow-50 text-yellow-800',
      HIGH:   'bg-orange-50 text-orange-700',
      URGENT: 'bg-red-50 text-red-700',
    };
    return map[priority] ?? 'bg-gray-100 text-gray-600';
  }

  typeBadgeClass(type: CaseType): string {
    return type === 'COMPLAINT'
      ? 'bg-purple-50 text-purple-700'
      : 'bg-teal-50 text-teal-700';
  }

  formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
}