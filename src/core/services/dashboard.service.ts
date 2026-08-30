import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DashboardSummaryResponse,
  MyOpenCaseResponse,
  InboxCaseResponse,
  InboxCountsResponse,
  InboxFilter
} from '../models/dashboard.models';
import { PagedResponse } from '../models/case.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {

  private readonly baseUrl = `${environment.apiUrl}/api/v1/dashboard`;

  constructor(private http: HttpClient) {}

  getSummary(): Observable<DashboardSummaryResponse> {
    return this.http.get<DashboardSummaryResponse>(`${this.baseUrl}/summary`);
  }

  getMyOpenCases(): Observable<MyOpenCaseResponse[]> {
    return this.http.get<MyOpenCaseResponse[]>(`${this.baseUrl}/my-open-cases`);
  }

  // US-49: paged, server-filtered work inbox for the logged-in HANDLER.
  // US-50/51: urgency quick filters + alternative sort; params are optional
  // so the full state is URL round-trippable (US-52).
  getMyInbox(filter: InboxFilter = {}): Observable<PagedResponse<InboxCaseResponse>> {
    let params = new HttpParams()
      .set('page', String(filter.page ?? 0))
      .set('size', String(filter.size ?? 20));
    if (filter.status) {
      params = params.set('status', filter.status);
    }
    if (filter.priority) {
      params = params.set('priority', filter.priority);
    }
    if (filter.keyword && filter.keyword.trim() !== '') {
      params = params.set('keyword', filter.keyword.trim());
    }
    if (filter.overdue) {
      params = params.set('overdue', 'true');
    }
    if (filter.dueToday) {
      params = params.set('dueToday', 'true');
    }
    if (filter.sort) {
      params = params.set('sort', filter.sort);
    }
    return this.http.get<PagedResponse<InboxCaseResponse>>(
      `${this.baseUrl}/my-inbox`, { params });
  }

  // US-50: quick-filter badge counts for the handler inbox.
  getMyInboxCounts(): Observable<InboxCountsResponse> {
    return this.http.get<InboxCountsResponse>(`${this.baseUrl}/my-inbox/counts`);
  }
}