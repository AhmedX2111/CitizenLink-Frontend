import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VolumeReportResponse } from '../models/report.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ReportService {

  private readonly baseUrl = `${environment.apiUrl}/api/v1/reports`;

  constructor(private http: HttpClient) {}

  getVolumeReport(from: string, to: string): Observable<VolumeReportResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<VolumeReportResponse>(`${this.baseUrl}/volume`, { params });
  }

  exportCsv(startDate?: string, endDate?: string): Observable<Blob> {
    let params = new HttpParams();
    if (startDate) params = params.set('startDate', startDate);
    if (endDate)   params = params.set('endDate',   endDate);
    return this.http.get(`${this.baseUrl}/export/csv`, {
      params,
      responseType: 'blob'
    });
  }
}
