import { Component, Input, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Note } from '../../../../core/models/note.models';
import { NoteService } from '../../../../core/services/note.service';

@Component({
    selector: 'app-case-notes',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
    templateUrl: './case-notes.html',
    styleUrls: ['./case-notes.css']
})
export class CaseNotesComponent implements OnInit {
    @Input() caseId!: string;

    private noteService = inject(NoteService);
    private fb = inject(FormBuilder);
    private transloco = inject(TranslocoService);

    notes = signal<Note[]>([]);
    isLoading = signal(true);
    isSubmitting = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    noteForm: FormGroup = this.fb.group({
        body: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
        internal: [true]
    });

    showForm = signal(false);

    ngOnInit(): void {
        this.loadNotes();
    }

    loadNotes(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.noteService.getNotesByCaseId(this.caseId).subscribe({
            next: (notes) => {
                this.notes.set(notes);
                this.isLoading.set(false);
            },
            error: (error) => {
                this.errorMessage.set('Failed to load notes. Please try again.');
                this.isLoading.set(false);
                console.error('Error loading notes:', error);
            }
        });
    }

    toggleForm(): void {
        this.showForm.update(v => !v);
        if (!this.showForm()) {
            this.noteForm.reset({ internal: true });
            this.errorMessage.set(null);
            this.successMessage.set(null);
        }
    }

    onSubmit(): void {
        if (this.noteForm.invalid) {
            this.noteForm.markAllAsTouched();
            return;
        }

        this.isSubmitting.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        const request = this.noteForm.value;

        this.noteService.addNote(this.caseId, request).subscribe({
            next: (note) => {
                this.isSubmitting.set(false);
                this.successMessage.set('Note added successfully!');
                
                // Add note to the beginning of the list (newest first)
                this.notes.update(notes => [note, ...notes]);
                
                // Reset form
                this.noteForm.reset({ internal: true });
                this.showForm.set(false);
                
                // Clear success message after 3 seconds
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.isSubmitting.set(false);
                this.errorMessage.set('Failed to add note. Please try again.');
                console.error('Error adding note:', error);
            }
        });
    }

    deleteNote(noteId: string): void {
        if (!confirm('Are you sure you want to delete this note?')) {
            return;
        }

        this.noteService.deleteNote(this.caseId, noteId).subscribe({
            next: () => {
                this.notes.update(notes => notes.filter(n => n.id !== noteId));
                this.successMessage.set('Note deleted successfully!');
                setTimeout(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.errorMessage.set('Failed to delete note. Please try again.');
                console.error('Error deleting note:', error);
            }
        });
    }

    isAuthor(note: Note): boolean {
        // Compare with current user ID from auth service
        // This is a placeholder - implement with actual auth
        return true;
    }

    formatDate(date: string): string {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    get canEdit(): boolean {
        // Check if user has permission to edit notes
        // Return true for AGENT, HANDLER, SUPERVISOR, ADMIN
        return true;
    }

    get canDelete(): boolean {
        // Check if user has permission to delete notes
        // Return true for ADMIN or author
        return true;
    }
}