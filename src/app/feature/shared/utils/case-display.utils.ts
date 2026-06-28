import { CaseStatus, Priority, CaseType } from '../../../../core/models/case.models';

export function statusBadgeClass(status: CaseStatus): string {
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

export function priorityBadgeClass(priority: Priority): string {
  const map: Record<Priority, string> = {
    LOW:    'bg-emerald-50 text-emerald-700',
    MEDIUM: 'bg-yellow-50 text-yellow-800',
    HIGH:   'bg-orange-50 text-orange-700',
    URGENT: 'bg-red-50 text-red-700',
  };
  return map[priority] ?? 'bg-gray-100 text-gray-600';
}

export function typeBadgeClass(type: CaseType): string {
  return type === 'COMPLAINT'
    ? 'bg-purple-50 text-purple-700'
    : 'bg-teal-50 text-teal-700';
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function isOverdue(dueAt: string | null): boolean {
  if (!dueAt) return false;
  return new Date(dueAt).getTime() < Date.now();
}
