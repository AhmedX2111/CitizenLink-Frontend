import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Category, CreateCategoryPayload, UpdateCategoryPayload } from '../models/category.model';
import { Department, CreateDepartmentPayload, UpdateDepartmentPayload } from '../models/department.model';

@Injectable({ providedIn: 'root' })
export class AdminService {

  private readonly categoriesUrl = `${environment.apiUrl}/api/v1/categories`;
  private readonly departmentsUrl = `${environment.apiUrl}/api/v1/departments`;

  constructor(private http: HttpClient) {}

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(this.categoriesUrl);
  }

  createCategory(data: CreateCategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.categoriesUrl, data);
  }

  updateCategory(id: string, data: UpdateCategoryPayload): Observable<Category> {
    return this.http.put<Category>(`${this.categoriesUrl}/${id}`, data);
  }

  getDepartments(): Observable<Department[]> {
    return this.http.get<Department[]>(this.departmentsUrl);
  }

  createDepartment(data: CreateDepartmentPayload): Observable<Department> {
    return this.http.post<Department>(this.departmentsUrl, data);
  }

  updateDepartment(id: string, data: UpdateDepartmentPayload): Observable<Department> {
    return this.http.put<Department>(`${this.departmentsUrl}/${id}`, data);
  }
}
