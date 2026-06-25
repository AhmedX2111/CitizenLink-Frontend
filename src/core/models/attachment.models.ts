export interface Attachment {
    id: string;
    caseId: string;
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileSizeFormatted: string;
    uploadedByUserId: string;
    uploadedByUserName: string;
    uploadedByUserRole: string;
    createdAt: string;
}

export interface AttachmentResponse {
    id: string;
    caseId: string;
    originalFileName: string;
    storedFileName: string;
    mimeType: string;
    fileSizeBytes: number;
    fileSizeFormatted: string;
    uploadedByUserId: string;
    uploadedByUserName: string;
    uploadedByUserRole: string;
    createdAt: string;
}