import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Note, AddNoteRequest } from '../models/note.models';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class NoteService {

    private readonly baseUrl = `${environment.apiUrl}/api/v1/cases`;

    constructor(private http: HttpClient) {}

    /**
     * US-15: Add a note to a case
     */
    addNote(caseId: string, request: AddNoteRequest): Observable<Note> {
        return this.http.post<Note>(`${this.baseUrl}/${caseId}/notes`, request);
    }

    /**
     * US-15: Get all notes for a case
     */
    getNotesByCaseId(caseId: string): Observable<Note[]> {
        return this.http.get<Note[]>(`${this.baseUrl}/${caseId}/notes`);
    }

    /**
     * Get a single note by ID
     */
    getNoteById(caseId: string, noteId: string): Observable<Note> {
        return this.http.get<Note>(`${this.baseUrl}/${caseId}/notes/${noteId}`);
    }

    /**
     * Update a note
     */
    updateNote(caseId: string, noteId: string, request: AddNoteRequest): Observable<Note> {
        return this.http.put<Note>(`${this.baseUrl}/${caseId}/notes/${noteId}`, request);
    }

    /**
     * Delete a note
     */
    deleteNote(caseId: string, noteId: string): Observable<void> {
        return this.http.delete<void>(`${this.baseUrl}/${caseId}/notes/${noteId}`);
    }

    /**
     * Count notes for a case
     */
    countNotes(caseId: string): Observable<number> {
        return this.http.get<number>(`${this.baseUrl}/${caseId}/notes/count`);
    }
}