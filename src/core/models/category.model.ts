export interface Category {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
  active: boolean;
}

export interface CreateCategoryPayload {
  nameEn: string;
  nameAr: string;
  active?: boolean;
}

export interface UpdateCategoryPayload {
  nameEn: string;
  nameAr: string;
  active?: boolean;
}

export interface CategoryResponse {
  content: Category[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}