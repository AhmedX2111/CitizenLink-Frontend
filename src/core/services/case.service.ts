import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CaseResponse,
  CaseSearchRequest,
  CreateCaseRequest,
  PagedResponse
} from '../models/case.models';
import { Department } from '../models/department.model';
import { Category } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CaseService {

  private readonly baseUrl = 'http://localhost:8080/api/v1/cases';
  private readonly departmentsUrl = 'http://localhost:8080/api/v1/departments';
  private readonly categoriesUrl = 'http://localhost:8080/api/v1/categories';

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

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.departmentsUrl);
  }

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.categoriesUrl);
  }
}