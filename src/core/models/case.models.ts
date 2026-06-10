export type CaseStatus =
  | 'NEW' | 'ASSIGNED' | 'IN_PROGRESS'
  | 'AWAITING_INFO' | 'SUSPENDED'
  | 'RESOLVED' | 'CLOSED' | 'CANCELLED';

export type CaseType     = 'COMPLAINT' | 'REQUEST';
export type Priority     = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Channel      = 'PHONE' | 'WEB' | 'WALK_IN' | 'EMAIL';

// ── Request DTOs ──────────────────────────────────────────────

export interface CreateCaseRequest {
  subject:           string;
  description:       string;
  type:              CaseType;
  priority:          Priority;
  channel:           Channel;
  citizenId:         string;   // raw UUID — internal use only
  categoryId:        string;
  departmentId:      string;
  assignedToUserId?: string;
  dueAt?:            string;   // ISO-8601 OffsetDateTime
}

export interface CaseSearchRequest {
  status?:           CaseStatus;
  type?:             CaseType;
  priority?:         Priority;
  assignedToUserId?: string;
  keyword?:          string;
  page?:             number;
  size?:             number;
}

// ── Response DTOs ─────────────────────────────────────────────

export interface CaseResponse {
  id:                    string;
  caseNumber:            string;
  subject:               string;
  description:           string;
  type:                  CaseType;
  priority:              Priority;
  status:                CaseStatus;
  channel:               Channel;
  resolutionSummary:     string | null;
  dueAt:                 string | null;
  citizenId:             string;
  citizenFullName:       string;
  citizenNationalId:     string;
  categoryId:            string;
  categoryNameEn:        string;
  categoryNameAr:        string;
  departmentId:          string;
  departmentNameEn:      string;
  departmentNameAr:      string;
  createdByUserId:       string;
  createdByDisplayName:  string;
  assignedToUserId:      string | null;
  assignedToDisplayName: string | null;
  createdAt:             string;
  updatedAt:             string;
  resolvedAt:            string | null;
  closedAt:              string | null;
}

export interface PagedResponse<T> {
  content:       T[];
  page:          number;
  size:          number;
  totalElements: number;
  totalPages:    number;
  first:         boolean;
  last:          boolean;
}