import { Component, Input, signal, inject, OnInit, DestroyRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Note } from '../../../../core/models/note.models';
import { NoteService } from '../../../../core/services/note.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { AuthTokenService } from '../../../auth/auth-token.service';

@Component({
    selector: 'app-case-notes',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslocoModule],
    templateUrl: './case-notes.html',
    styleUrls: ['./case-notes.css']
})
export class CaseNotesComponent implements OnInit, OnDestroy {
    @Input() caseId!: string;

    private noteService = inject(NoteService);
    private fb = inject(FormBuilder);
    private logger = inject(LoggerService);
    private transloco = inject(TranslocoService);
    private tokenService = inject(AuthTokenService);
    private destroyRef = inject(DestroyRef);
    private timers = new Set<ReturnType<typeof setTimeout>>();

    notes = signal<Note[]>([]);
    isLoading = signal(true);
    isSubmitting = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);
    confirmDeleteId = signal<string | null>(null);

    noteForm: FormGroup = this.fb.group({
        body: ['', [Validators.required, Validators.minLength(1), Validators.maxLength(5000)]],
        internal: [true]
    });

    showForm = signal(false);

    ngOnInit(): void {
        this.loadNotes();
    }

    private schedule(fn: () => void, ms: number): void {
        const handle = setTimeout(() => {
            this.timers.delete(handle);
            fn();
        }, ms);
        this.timers.add(handle);
    }

    ngOnDestroy(): void {
        this.timers.forEach(clearTimeout);
        this.timers.clear();
    }

    loadNotes(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.noteService.getNotesByCaseId(this.caseId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (notes) => {
                this.notes.set(notes);
                this.isLoading.set(false);
            },
            error: (error) => {
                this.errorMessage.set('Failed to load notes. Please try again.');
                this.isLoading.set(false);
                this.logger.error('CaseNotesComponent', 'Error loading notes:', error);
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

        this.noteService.addNote(this.caseId, request).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (note) => {
                this.isSubmitting.set(false);
                this.successMessage.set('Note added successfully!');
                
                // Add note to the beginning of the list (newest first)
                this.notes.update(notes => [note, ...notes]);
                
                // Reset form
                this.noteForm.reset({ internal: true });
                this.showForm.set(false);
                
                // Clear success message after 3 seconds
                this.schedule(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.isSubmitting.set(false);
                this.errorMessage.set('Failed to add note. Please try again.');
                this.logger.error('CaseNotesComponent', 'Error adding note:', error);
            }
        });
    }

    requestDeleteNote(noteId: string): void {
        this.confirmDeleteId.set(noteId);
    }

    confirmDeleteNote(noteId: string): void {
        this.confirmDeleteId.set(null);
        this.noteService.deleteNote(this.caseId, noteId).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => {
                this.notes.update(notes => notes.filter(n => n.id !== noteId));
                this.successMessage.set('Note deleted successfully!');
                this.schedule(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.errorMessage.set('Failed to delete note. Please try again.');
                this.logger.error('CaseNotesComponent', 'Error deleting note:', error);
            }
        });
    }

    cancelDeleteNote(): void {
        this.confirmDeleteId.set(null);
    }

    isAuthor(note: Note): boolean {
        const user = this.tokenService.getUserData();
        return !!user && user.username === note.authorUsername;
    }

    canDeleteNote(note: Note): boolean {
        const user = this.tokenService.getUserData();
        if (!user) return false;
        return user.role === 'ADMIN' || user.username === note.authorUsername;
    }

    formatDate(date: string): string {
        return new Date(date).toLocaleDateString('en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }
}