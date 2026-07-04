import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VolumeReportResponse } from '../models/report.models';

@Injectable({ providedIn: 'root' })
export class ReportService {

  private readonly baseUrl = 'http://localhost:8080/api/v1/reports';

  constructor(private http: HttpClient) {}

  getVolumeReport(from: string, to: string): Observable<VolumeReportResponse> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<VolumeReportResponse>(`${this.baseUrl}/volume`, { params });
  }
}