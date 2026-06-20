import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardSummaryResponse, MyOpenCaseResponse } from '../models/dashboard.models';
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
}