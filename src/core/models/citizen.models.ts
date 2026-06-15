export interface Citizen {
    id: string;
    fullName: string;
    nationalId: string;
    phone: string;
    email: string;
    preferredLanguage: string;
    createdAt: string;
    caseCount: number;
}

export interface PagedResponse<T> {
    content: T[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
    first: boolean;
    last: boolean;
}

export interface CitizenSearchRequest {
    searchTerm: string;
    page: number;
    size: number;
}