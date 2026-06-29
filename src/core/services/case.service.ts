import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CaseResponse,
  CaseSearchRequest,
  CreateCaseRequest,
  StatusHistoryResponse,
  PagedResponse,
  CaseTransitionRequest,
  CaseActionResponse,
  HandlerResponse
} from '../models/case.models';
import { Department } from '../models/department.model';
import { Category } from '../models/category.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CaseService {

  private readonly baseUrl = `${environment.apiUrl}/api/v1/cases`;
  private readonly usersUrl = `${environment.apiUrl}/api/v1/users`;
  private readonly departmentsUrl = `${environment.apiUrl}/api/v1/departments`;
  private readonly categoriesUrl = `${environment.apiUrl}/api/v1/categories`;

  constructor(private http: HttpClient) {}

  createCase(request: CreateCaseRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(this.baseUrl, request);
  }

  searchCases(filter: CaseSearchRequest): Observable<PagedResponse<CaseResponse>> {
    let params = new HttpParams();

    if (filter.status)           params = params.set('status',           filter.status);
    if (filter.type)             params = params.set('type',             filter.type);
    if (filter.priority)         params = params.set('priority',         filter.priority);
    if (filter.assignedToUserId) params = params.set('assignedToUserId', filter.assignedToUserId);
    if (filter.keyword?.trim())  params = params.set('keyword',          filter.keyword.trim());
    if (filter.page  != null)    params = params.set('page',             filter.page.toString());
    if (filter.size  != null)    params = params.set('size',             filter.size.toString());

    return this.http.get<PagedResponse<CaseResponse>>(this.baseUrl, { params });
  }

  /**
   * Fetches full case details by ID for the details modal.
   * Backend enforces Phase 1 visibility — returns 404 if not visible
   * to the current user (case belongs to someone else, or doesn't exist).
   */
  getCaseById(id: string): Observable<CaseResponse> {
    return this.http.get<CaseResponse>(`${this.baseUrl}/${id}`);
  }

  /**
   * US-14: fetches the full chronological status-history timeline for a case.
   * Backend enforces Phase 1 visibility — 404 if not visible to current user.
   */
  getCaseTimeline(id: string): Observable<StatusHistoryResponse[]> {
    return this.http.get<StatusHistoryResponse[]>(`${this.baseUrl}/${id}/timeline`);
  }

  /**
   * US-17: fetches the workflow action buttons the current user may
   * use on this case right now.
   */
  getCaseActions(id: string): Observable<CaseActionResponse[]> {
    return this.http.get<CaseActionResponse[]>(`${this.baseUrl}/${id}/actions`);
  }

  /**
   * WFL-01: executes a workflow transition. Backend independently
   * validates and returns 409 if the transition is illegal — the
   * frontend's button visibility is a UX convenience, not the source
   * of truth for authorization.
   */
  transitionCase(id: string, request: CaseTransitionRequest): Observable<CaseResponse> {
    return this.http.post<CaseResponse>(`${this.baseUrl}/${id}/transition`, request);
  }

  getHandlers(): Observable<HandlerResponse[]> {
    return this.http.get<HandlerResponse[]>(`${this.usersUrl}/handlers`);
  }

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.departmentsUrl);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.categoriesUrl);
  }
}