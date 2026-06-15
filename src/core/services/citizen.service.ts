import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/case.models';
import { Citizen } from '../models/citizen.models';

@Injectable({
  providedIn: 'root'
})
export class CitizenService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/citizens`;

  constructor(private http: HttpClient) {}

  /**
   * US-07: Search for citizens
   * @param searchTerm - Name (partial), national ID, or phone number
   * @param page - Page number (0-based)
   * @param size - Page size
   */
  searchCitizens(searchTerm: string, page: number = 0, size: number = 20): Observable<PagedResponse<Citizen>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());
    
    if (searchTerm && searchTerm.trim()) {
      params = params.set('searchTerm', searchTerm.trim());
    }
    
    return this.http.get<PagedResponse<Citizen>>(`${this.API_URL}/search`, { params });
  }

  /**
   * Get citizen by ID (for Citizen 360)
   */
  getCitizenById(id: string): Observable<Citizen> {
    return this.http.get<Citizen>(`${this.API_URL}/${id}`);
  }
}