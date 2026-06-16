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

export interface PageResponse<T> {
    content: T[];
    pageable: {
        pageNumber: number;
        pageSize: number;
    };
    totalPages: number;
    totalElements: number;
    size: number;
    number: number;
    first: boolean;
    last: boolean;
    empty: boolean;
}

export interface CitizenSearchRequest {
    searchTerm: string;
    page: number;
    size: number;
}

export interface CreateCitizenRequest {
    fullName: string;
    nationalId: string;
    phone: string;
    email?: string;
    preferredLanguage: string;
}