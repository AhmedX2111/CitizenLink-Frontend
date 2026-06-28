export interface Note {
    id: string;
    caseId: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    body: string;
    internal: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface AddNoteRequest {
    body: string;
    internal: boolean;
}

export interface NoteResponse {
    id: string;
    caseId: string;
    authorId: string;
    authorName: string;
    authorRole: string;
    body: string;
    internal: boolean;
    createdAt: string;
    updatedAt: string;
}