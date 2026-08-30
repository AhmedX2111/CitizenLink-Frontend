import { CaseStatus, Priority } from './case.models';

export interface KpiSummary {
  openCases:         number;
  resolvedThisMonth: number;
  overdueCases:      number;
  newToday:          number;
}

export interface DashboardSummaryResponse {
  kpis:         KpiSummary;
  statusCounts: Record<CaseStatus, number>;
}

export interface MyOpenCaseResponse {
  id:          string;
  caseNumber:  string;
  subject:     string;
  status:      CaseStatus;
  dueAt:       string | null;
}

// US-49: handler work inbox - one row per open case assigned to the handler.
export interface InboxCaseResponse {
  id:              string;
  caseNumber:      string;
  subject:         string;
  citizenFullName: string;
  priority:        Priority;
  status:          CaseStatus;
  dueAt:           string | null;
  updatedAt:       string | null;
}

// US-49: server-side filter/pagination params for the inbox.
// US-50/51: quick urgency filters, alternative sort, URL round-trippable (US-52).
export type InboxSort = 'SMART' | 'DUE_DATE' | 'PRIORITY' | 'NEWEST';

export interface InboxFilter {
  status?:   CaseStatus;
  priority?: Priority;
  keyword?:  string;
  overdue?:  boolean;
  dueToday?: boolean;
  sort?:     InboxSort;
  page?:     number;
  size?:     number;
}

// US-50: quick-filter badge counts for the handler inbox.
export interface InboxCountsResponse {
  all:            number;
  overdue:        number;
  dueToday:       number;
  urgent:         number;
  awaitingInfo:   number;
  newlyAssigned:  number;
}