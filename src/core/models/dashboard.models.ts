import { CaseStatus } from './case.models';

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