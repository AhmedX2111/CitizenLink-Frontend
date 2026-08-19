import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { UserResponse, CreateUserRequest, UpdateUserRequest } from '../models/user.models';
import { PagedResponse } from '../models/case.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class UserAdminService {

  private readonly baseUrl = `${environment.apiUrl}/api/v1/users`;

  constructor(private readonly http: HttpClient) {}

  getUsers(
    role: string,
    active: string,
    page: number,
    size: number
  ): Observable<PagedResponse<UserResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (role)   params = params.set('role',   role);
    if (active !== '') params = params.set('active', active);

    return this.http.get<PagedResponse<UserResponse>>(this.baseUrl, { params });
  }

  getUserById(id: string): Observable<UserResponse> {
    return this.http.get<UserResponse>(`${this.baseUrl}/${id}`);
  }

  createUser(data: CreateUserRequest): Observable<UserResponse> {
    return this.http.post<UserResponse>(this.baseUrl, data);
  }

  updateUser(id: string, data: UpdateUserRequest): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/${id}`, data);
  }

  deactivateUser(id: string): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/${id}/deactivate`, {});
  }

  activateUser(id: string): Observable<UserResponse> {
    return this.http.put<UserResponse>(`${this.baseUrl}/${id}/activate`, {});
  }
}