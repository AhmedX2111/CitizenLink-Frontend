/*
 * CaseNotesComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - should create
 *   - loadNotes success (sets notes, clears loading) / error (sets message, logs)
 *   - toggleForm open/close behaviour and form reset on close
 *   - onSubmit: invalid form -> no service call; valid -> addNote, prepends note,
 *     resets form, closes form, clears success message after 3s
 *   - delete flow: requestDeleteNote / cancelDeleteNote / confirmDeleteNote
 *   - isAuthor / canDeleteNote: ADMIN, author, non-author, no user
 *   - formatDate produces a human-readable date
 *   - destroy clears pending message timers so no signal is written after teardown (M-25)
 *
 * SKIPPED (with reason):
 *   - Note update / single fetch endpoints (updateNote, getNoteById) are not exposed
 *     by the component and are covered only if added to the UI.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CaseNotesComponent } from './case-notes';
import { NoteService } from '../../../../core/services/note.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { AuthTokenService } from '../../../auth/auth-token.service';
import { TranslocoService } from '@jsverse/transloco';
import { Note } from '../../../../core/models/note.models';

const mockNote: Note = {
  id: 'note-1',
  caseId: 'case-1',
  authorId: 'u-1',
  authorName: 'Agent One',
  authorUsername: 'agent',
  authorRole: 'AGENT',
  body: 'Called citizen, all good',
  internal: true,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z'
};

const adminUser = {
  token: 'jwt',
  id: 'u-admin',
  username: 'admin',
  displayName: 'Admin',
  email: 'admin@example.com',
  role: 'ADMIN' as const
};

const authorUser = {
  token: 'jwt',
  id: 'u-1',
  username: 'agent',
  displayName: 'Agent One',
  email: 'agent@example.com',
  role: 'AGENT' as const
};

describe('CaseNotesComponent', () => {
  let fixture: ComponentFixture<CaseNotesComponent>;
  let component: CaseNotesComponent;

  let noteService: {
    getNotesByCaseId: ReturnType<typeof vi.fn>;
    addNote: ReturnType<typeof vi.fn>;
    deleteNote: ReturnType<typeof vi.fn>;
  };
  let tokenService: { getUserData: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };
  let transloco: { translate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    noteService = {
      getNotesByCaseId: vi.fn().mockReturnValue(of([mockNote])),
      addNote: vi.fn().mockReturnValue(of(mockNote)),
      deleteNote: vi.fn().mockReturnValue(of(undefined))
    };
    tokenService = { getUserData: vi.fn().mockReturnValue(null) };
    logger = { error: vi.fn() };
    transloco = { translate: vi.fn((key: string) => key) };

    await TestBed.configureTestingModule({
      imports: [CaseNotesComponent],
      providers: [
        { provide: NoteService, useValue: noteService },
        { provide: AuthTokenService, useValue: tokenService },
        { provide: LoggerService, useValue: logger },
        { provide: TranslocoService, useValue: transloco }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseNotesComponent);
    component = fixture.componentInstance;
    component.caseId = 'case-1';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadNotes', () => {
    it('loads notes for the case and clears the loading flag', () => {
      component.ngOnInit();

      expect(noteService.getNotesByCaseId).toHaveBeenCalledWith('case-1');
      expect(component.notes()).toEqual([mockNote]);
      expect(component.isLoading()).toBe(false);
    });

    it('sets an error message and logs when loading fails', () => {
      noteService.getNotesByCaseId.mockReturnValue(throwError(() => ({ status: 500 })));
      component.ngOnInit();

      expect(component.errorMessage()).toBe('Failed to load notes. Please try again.');
      expect(component.isLoading()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('toggleForm', () => {
    it('opens and closes the form and resets state when closing', () => {
      component.toggleForm();
      expect(component.showForm()).toBe(true);

      component.noteForm.patchValue({ body: 'dirty' });
      component.errorMessage.set('old error');
      component.successMessage.set('old success');

      component.toggleForm();
      expect(component.showForm()).toBe(false);
      expect(component.noteForm.get('body')?.value).toBeNull();
      expect(component.errorMessage()).toBeNull();
      expect(component.successMessage()).toBeNull();
    });
  });

  describe('onSubmit', () => {
    it('does not call the service when the form is invalid', () => {
      component.noteForm.get('body')?.setValue('');
      component.onSubmit();

      expect(noteService.addNote).not.toHaveBeenCalled();
    });

    it('adds a note, prepends it, resets the form and clears the success message after 3s', () => {
      vi.useFakeTimers();
      const newNote = { ...mockNote, id: 'note-2', body: 'Second note' };
      noteService.addNote.mockReturnValue(of(newNote));
      component.notes.set([mockNote]);
      component.noteForm.patchValue({ body: 'Second note', internal: false });

      component.onSubmit();

      expect(noteService.addNote).toHaveBeenCalledWith('case-1', {
        body: 'Second note',
        internal: false
      });
      expect(component.notes()).toEqual([newNote, mockNote]);
      expect(component.showForm()).toBe(false);
      expect(component.noteForm.get('body')?.value).toBeNull();
      expect(component.successMessage()).toBe('Note added successfully!');
      expect(component.isSubmitting()).toBe(false);

      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBeNull();
    });

    it('clears pending message timers when the component is destroyed (M-25)', () => {
      vi.useFakeTimers();
      noteService.addNote.mockReturnValue(of(mockNote));
      component.noteForm.patchValue({ body: 'Valid note' });

      component.onSubmit();
      expect(component.successMessage()).toBe('Note added successfully!');

      fixture.destroy();
      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBe('Note added successfully!');
    });

    it('sets an error message when adding a note fails', () => {
      noteService.addNote.mockReturnValue(throwError(() => ({ status: 500 })));
      component.noteForm.patchValue({ body: 'Valid note' });

      component.onSubmit();

      expect(component.errorMessage()).toBe('Failed to add note. Please try again.');
      expect(component.isSubmitting()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('delete flow', () => {
    it('requestDeleteNote tracks the note to confirm', () => {
      component.requestDeleteNote('note-1');
      expect(component.confirmDeleteId()).toBe('note-1');
    });

    it('cancelDeleteNote clears the confirmation state', () => {
      component.requestDeleteNote('note-1');
      component.cancelDeleteNote();
      expect(component.confirmDeleteId()).toBeNull();
    });

    it('confirmDeleteNote removes the note and clears the success message after 3s', () => {
      vi.useFakeTimers();
      component.notes.set([mockNote]);
      component.confirmDeleteNote('note-1');

      expect(noteService.deleteNote).toHaveBeenCalledWith('case-1', 'note-1');
      expect(component.notes()).toEqual([]);
      expect(component.confirmDeleteId()).toBeNull();
      expect(component.successMessage()).toBe('Note deleted successfully!');

      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBeNull();
    });

    it('sets an error message when deletion fails', () => {
      noteService.deleteNote.mockReturnValue(throwError(() => ({ status: 500 })));
      component.confirmDeleteNote('note-1');

      expect(component.errorMessage()).toBe('Failed to delete note. Please try again.');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('isAuthor / canDeleteNote', () => {
    it('isAuthor returns true when the current user wrote the note', () => {
      tokenService.getUserData.mockReturnValue(authorUser);
      expect(component.isAuthor(mockNote)).toBe(true);
    });

    it('isAuthor returns false for a different user or no user', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(component.isAuthor(mockNote)).toBe(false);

      tokenService.getUserData.mockReturnValue(null);
      expect(component.isAuthor(mockNote)).toBe(false);
    });

    it('canDeleteNote returns true for ADMIN regardless of authorship', () => {
      tokenService.getUserData.mockReturnValue(adminUser);
      expect(component.canDeleteNote(mockNote)).toBe(true);
    });

    it('canDeleteNote returns true for the note author', () => {
      tokenService.getUserData.mockReturnValue(authorUser);
      expect(component.canDeleteNote(mockNote)).toBe(true);
    });

    it('canDeleteNote returns false for a non-admin non-author', () => {
      tokenService.getUserData.mockReturnValue({
        ...authorUser,
        id: 'u-other',
        username: 'other-agent',
        role: 'HANDLER'
      });
      expect(component.canDeleteNote(mockNote)).toBe(false);
    });

    it('canDeleteNote returns false when there is no current user', () => {
      tokenService.getUserData.mockReturnValue(null);
      expect(component.canDeleteNote(mockNote)).toBe(false);
    });
  });

  describe('formatDate', () => {
    it('formats an ISO date into a readable string', () => {
      const formatted = component.formatDate('2026-01-01T10:00:00Z');
      expect(formatted).toContain('2026');
    });
  });
});
