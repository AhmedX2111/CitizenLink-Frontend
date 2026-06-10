export interface Category {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  active: boolean;
  sortOrder: number;
}

export interface CategoryResponse {
  content: Category[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}