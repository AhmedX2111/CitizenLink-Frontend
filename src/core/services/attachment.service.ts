import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Attachment } from '../models/attachment.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AttachmentService {

    private readonly baseUrl = `${environment.apiUrl}/api/v1/cases`;

    constructor(private http: HttpClient) {}

    /**
     * US-16: Upload an attachment to a case
     */
    uploadAttachment(caseId: string, file: File): Observable<Attachment> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<Attachment>(`${this.baseUrl}/${caseId}/attachments`, formData);
    }

    /**
     * US-16: Get all attachments for a case
     */
    getAttachmentsByCaseId(caseId: string): Observable<Attachment[]> {
        return this.http.get<Attachment[]>(`${this.baseUrl}/${caseId}/attachments`);
    }

    /**
     * US-16: Download an attachment
     */
    downloadAttachment(caseId: string, attachmentId: string): Observable<Blob> {
        return this.http.get(`${this.baseUrl}/${caseId}/attachments/${attachmentId}/download`, {
            responseType: 'blob'
        });
    }

    /**
     * Delete an attachment
     */
    deleteAttachment(caseId: string, attachmentId: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${caseId}/attachments/${attachmentId}`);
    }

    /**
     * Count attachments for a case
     */
    countAttachments(caseId: string): Observable<number> {
        return this.http.get<number>(`${this.baseUrl}/${caseId}/attachments/count`);
    }
}