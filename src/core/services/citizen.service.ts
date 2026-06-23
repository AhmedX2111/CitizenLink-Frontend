import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PagedResponse } from '../models/case.models';
import { Citizen, CitizenProfile, CreateCitizenRequest } from '../models/citizen.models';

@Injectable({
  providedIn: 'root'
})
export class CitizenService {
  private readonly API_URL = `${environment.apiUrl}/api/v1/citizens`;

  constructor(private http: HttpClient) {}

  /**
   * US-07: Search for citizens
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
   * US-09: Create a new citizen
   */
  createCitizen(request: CreateCitizenRequest): Observable<Citizen> {
    return this.http.post<Citizen>(this.API_URL, request);
  }

  /**
   * US-08: Get citizen profile with case history
   * GET /api/v1/citizens/{id}/profile
   */
  getCitizenProfile(id: string): Observable<CitizenProfile> {
    return this.http.get<CitizenProfile>(`${this.API_URL}/profile/${id}`);
  }

  /**
   * Get citizen by ID (for Citizen profile)
   */
  getCitizenById(id: string): Observable<Citizen> {
    return this.http.get<Citizen>(`${this.API_URL}/${id}`);
  }
}