export interface Department {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  active: boolean;
}

export interface DepartmentResponse {
  content: Department[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}