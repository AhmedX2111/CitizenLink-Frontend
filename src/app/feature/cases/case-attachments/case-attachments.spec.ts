/*
 * CaseAttachmentsComponent spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - should create
 *   - loadAttachments success / error
 *   - onFileSelected delegates the picked file to uploadFile and resets the input
 *   - uploadFile: invalid type, oversize file, success, server error message, generic error
 *   - isAllowedExtension valid / invalid
 *   - downloadAttachment success / error
 *   - delete flow: requestDelete with auto-cancel, cancelDelete, confirmDelete success/error
 *   - formatFileSize B / KB / MB
 *   - formatDate respects the active language
 *
 * SKIPPED (with reason):
 *   - triggerFileUpload: relies on a DOM element injected by the template; covered
 *     implicitly when the component renders in an end-to-end context.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { CaseAttachmentsComponent } from './case-attachments';
import { AttachmentService } from '../../../../core/services/attachment.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoService } from '@jsverse/transloco';
import { Attachment } from '../../../../core/models/attachment.models';

const mockAttachment: Attachment = {
  id: 'att-1',
  caseId: 'case-1',
  originalFileName: 'invoice.pdf',
  storedFileName: 'stored-1.pdf',
  mimeType: 'application/pdf',
  fileSizeBytes: 2048,
  fileSizeFormatted: '2.0 KB',
  uploadedByUserId: 'u-1',
  uploadedByUserName: 'Agent One',
  uploadedByUserRole: 'AGENT',
  createdAt: '2026-01-01T10:00:00Z'
};

describe('CaseAttachmentsComponent', () => {
  let fixture: ComponentFixture<CaseAttachmentsComponent>;
  let component: CaseAttachmentsComponent;

  let attachmentService: {
    getAttachmentsByCaseId: ReturnType<typeof vi.fn>;
    uploadAttachment: ReturnType<typeof vi.fn>;
    downloadAttachment: ReturnType<typeof vi.fn>;
    deleteAttachment: ReturnType<typeof vi.fn>;
  };
  let logger: { error: ReturnType<typeof vi.fn> };
  let transloco: { translate: ReturnType<typeof vi.fn>; getActiveLang: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    attachmentService = {
      getAttachmentsByCaseId: vi.fn().mockReturnValue(of([mockAttachment])),
      uploadAttachment: vi.fn().mockReturnValue(of(mockAttachment)),
      downloadAttachment: vi.fn().mockReturnValue(of(new Blob())),
      deleteAttachment: vi.fn().mockReturnValue(of(undefined))
    };
    logger = { error: vi.fn() };
    transloco = {
      translate: vi.fn((key: string) => key),
      getActiveLang: vi.fn().mockReturnValue('en')
    };

    await TestBed.configureTestingModule({
      imports: [CaseAttachmentsComponent],
      providers: [
        { provide: AttachmentService, useValue: attachmentService },
        { provide: LoggerService, useValue: logger },
        { provide: TranslocoService, useValue: transloco }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseAttachmentsComponent);
    component = fixture.componentInstance;
    component.caseId = 'case-1';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('loadAttachments', () => {
    it('loads attachments for the case and clears the loading flag', () => {
      component.ngOnInit();

      expect(attachmentService.getAttachmentsByCaseId).toHaveBeenCalledWith('case-1');
      expect(component.attachments()).toEqual([mockAttachment]);
      expect(component.isLoading()).toBe(false);
    });

    it('sets an error message and logs when loading fails', () => {
      attachmentService.getAttachmentsByCaseId.mockReturnValue(throwError(() => ({ status: 500 })));
      component.ngOnInit();

      expect(component.errorMessage()).toBe('cases.detail.attachments.loadError');
      expect(component.isLoading()).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('onFileSelected', () => {
    it('delegates the first file to uploadFile and clears the input', () => {
      const uploadSpy = vi.spyOn(component, 'uploadFile').mockImplementation(() => undefined);
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      const input = { files: [file], value: 'C:\\fakepath\\a.pdf' } as unknown as HTMLInputElement;

      component.onFileSelected({ target: input } as unknown as Event);

      expect(uploadSpy).toHaveBeenCalledWith(file);
      expect(input.value).toBe('');
    });
  });

  describe('uploadFile', () => {
    it('rejects files whose type and extension are not allowed', () => {
      vi.useFakeTimers();
      const file = new File(['x'], 'script.exe', { type: 'application/x-msdownload' });
      component.uploadFile(file);

      expect(component.errorMessage()).toBe('cases.detail.attachments.invalidType');
      expect(attachmentService.uploadAttachment).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
    });

    it('rejects files larger than the maximum size', () => {
      vi.useFakeTimers();
      const bigFile = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.pdf', {
        type: 'application/pdf'
      });
      component.uploadFile(bigFile);

      expect(component.errorMessage()).toBe('cases.detail.attachments.fileTooLarge');
      expect(attachmentService.uploadAttachment).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
    });

    it('uploads an allowed file and prepends it to the list', () => {
      vi.useFakeTimers();
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
      component.attachments.set([mockAttachment]);

      component.uploadFile(file);

      expect(attachmentService.uploadAttachment).toHaveBeenCalledWith('case-1', file);
      expect(component.attachments()).toEqual([mockAttachment, mockAttachment]);
      expect(component.successMessage()).toBe('cases.detail.attachments.uploadSuccess');
      expect(component.isUploading()).toBe(false);

      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBeNull();
    });

    it('shows the server-provided message when the upload fails', () => {
      attachmentService.uploadAttachment.mockReturnValue(
        throwError(() => ({ error: { message: 'Storage full' } }))
      );
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

      component.uploadFile(file);

      expect(component.errorMessage()).toBe('Storage full');
      expect(component.isUploading()).toBe(false);
    });

    it('falls back to the generic message when the failure has no message', () => {
      attachmentService.uploadAttachment.mockReturnValue(throwError(() => ({ status: 500 })));
      const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });

      component.uploadFile(file);

      expect(component.errorMessage()).toBe('cases.detail.attachments.uploadError');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('isAllowedExtension', () => {
    it('accepts the allowed extensions case-insensitively', () => {
      expect(component.isAllowedExtension('file.pdf')).toBe(true);
      expect(component.isAllowedExtension('photo.PNG')).toBe(true);
      expect(component.isAllowedExtension('doc.docx')).toBe(true);
    });

    it('rejects disallowed extensions', () => {
      expect(component.isAllowedExtension('file.exe')).toBe(false);
      expect(component.isAllowedExtension('file')).toBe(false);
    });
  });

  describe('downloadAttachment', () => {
    it('shows a success message when the download succeeds', () => {
      vi.useFakeTimers();
      component.downloadAttachment(mockAttachment);

      expect(attachmentService.downloadAttachment).toHaveBeenCalledWith('case-1', 'att-1');
      expect(component.successMessage()).toBe('cases.detail.attachments.downloadSuccess');

      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBeNull();
    });

    it('shows an error message and logs when the download fails', () => {
      vi.useFakeTimers();
      attachmentService.downloadAttachment.mockReturnValue(throwError(() => ({ status: 500 })));
      component.downloadAttachment(mockAttachment);

      expect(component.errorMessage()).toBe('cases.detail.attachments.downloadError');
      expect(logger.error).toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('delete flow', () => {
    it('requestDelete tracks the attachment and auto-cancels after 5s', () => {
      vi.useFakeTimers();
      component.requestDelete('att-1');
      expect(component.confirmDeleteId()).toBe('att-1');

      vi.advanceTimersByTime(5000);
      expect(component.confirmDeleteId()).toBeNull();
    });

    it('cancelDelete clears the confirmation state', () => {
      component.requestDelete('att-1');
      component.cancelDelete();
      expect(component.confirmDeleteId()).toBeNull();
    });

    it('confirmDelete removes the attachment and shows a success message', () => {
      vi.useFakeTimers();
      component.attachments.set([mockAttachment]);

      component.confirmDelete(mockAttachment);

      expect(attachmentService.deleteAttachment).toHaveBeenCalledWith('case-1', 'att-1');
      expect(component.attachments()).toEqual([]);
      expect(component.confirmDeleteId()).toBeNull();
      expect(component.successMessage()).toBe('cases.detail.attachments.deleteSuccess');

      vi.advanceTimersByTime(3000);
      expect(component.successMessage()).toBeNull();
    });

    it('confirmDelete sets an error message when deletion fails', () => {
      vi.useFakeTimers();
      attachmentService.deleteAttachment.mockReturnValue(throwError(() => ({ status: 500 })));
      component.confirmDelete(mockAttachment);

      expect(component.errorMessage()).toBe('cases.detail.attachments.deleteError');
      expect(logger.error).toHaveBeenCalled();

      vi.advanceTimersByTime(5000);
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes, kilobytes and megabytes', () => {
      expect(component.formatFileSize(512)).toBe('512 B');
      expect(component.formatFileSize(1536)).toBe('1.5 KB');
      expect(component.formatFileSize(2 * 1024 * 1024)).toBe('2.0 MB');
    });
  });

  describe('formatDate', () => {
    it('uses the active language locale', () => {
      transloco.getActiveLang.mockReturnValue('ar');
      const ar = component.formatDate('2026-01-01T10:00:00Z');

      transloco.getActiveLang.mockReturnValue('en');
      const en = component.formatDate('2026-01-01T10:00:00Z');

      expect(transloco.getActiveLang).toHaveBeenCalled();
      expect(ar).not.toBe(en);
      expect(en).toContain('2026');
    });
  });
});
