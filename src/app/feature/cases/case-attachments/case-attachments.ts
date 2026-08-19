import { Component, input, ViewChild, ElementRef, signal, inject, OnInit, DestroyRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttachmentService } from '../../../../core/services/attachment.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { Attachment } from '../../../../core/models/attachment.models';
import { errorCode, logServerError } from '../../../../core/utils/server-error';

@Component({
    selector: 'app-case-attachments',
    standalone: true,
    imports: [CommonModule, TranslocoModule],
    templateUrl: './case-attachments.html',
    styleUrls: ['./case-attachments.css']
})
export class CaseAttachmentsComponent implements OnInit, OnDestroy {
    caseId = input.required<string>();

    @ViewChild('fileInput') private fileInput!: ElementRef<HTMLInputElement>;

    private attachmentService = inject(AttachmentService);
    private logger = inject(LoggerService);
    private transloco = inject(TranslocoService);
    private destroyRef = inject(DestroyRef);
    private timers = new Set<ReturnType<typeof setTimeout>>();

    attachments = signal<Attachment[]>([]);
    isLoading = signal(true);
    isUploading = signal(false);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);
    confirmDeleteId = signal<string | null>(null);  // Track which attachment to delete

    allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    maxFileSize = 5 * 1024 * 1024; // 5 MB

    ngOnInit(): void {
        this.loadAttachments();
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

    loadAttachments(): void {
        this.isLoading.set(true);
        this.errorMessage.set(null);

        this.attachmentService.getAttachmentsByCaseId(this.caseId()).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (attachments) => {
                this.attachments.set(attachments);
                this.isLoading.set(false);
            },
            error: (error) => {
                this.errorMessage.set(this.transloco.translate('cases.detail.attachments.loadError'));
                this.isLoading.set(false);
                this.logger.error('CaseAttachmentsComponent', 'Error loading attachments:', error);
            }
        });
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        if (input.files && input.files.length > 0) {
            const file = input.files[0];
            this.uploadFile(file);
        }
        input.value = '';
    }

    uploadFile(file: File): void {
        if (!this.allowedTypes.includes(file.type) && !this.isAllowedExtension(file.name)) {
            this.errorMessage.set(this.transloco.translate('cases.detail.attachments.invalidType'));
            this.schedule(() => this.errorMessage.set(null), 5000);
            return;
        }

        if (file.size > this.maxFileSize) {
            this.errorMessage.set(this.transloco.translate('cases.detail.attachments.fileTooLarge'));
            this.schedule(() => this.errorMessage.set(null), 5000);
            return;
        }

        this.isUploading.set(true);
        this.errorMessage.set(null);
        this.successMessage.set(null);

        this.attachmentService.uploadAttachment(this.caseId(), file).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (attachment) => {
                this.isUploading.set(false);
                this.successMessage.set(this.transloco.translate('cases.detail.attachments.uploadSuccess'));
                this.attachments.update(list => [attachment, ...list]);
                this.schedule(() => this.successMessage.set(null), 3000);
            },
error: (error) => {
                this.isUploading.set(false);
                logServerError(this.logger, 'CaseAttachmentsComponent', error);
                this.errorMessage.set(
                    errorCode(error) === 'PAYLOAD_TOO_LARGE'
                        ? this.transloco.translate('cases.detail.attachments.fileTooLarge')
                        : this.transloco.translate('cases.detail.attachments.uploadError')
                );
            }
        });
    }

    isAllowedExtension(fileName: string): boolean {
        const allowedExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.docx'];
        const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
        return allowedExtensions.includes(ext);
    }

    downloadAttachment(attachment: Attachment): void {
        this.attachmentService.downloadAttachment(this.caseId(), attachment.id).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: (blob) => {
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = attachment.originalFileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);

                this.successMessage.set(this.transloco.translate('cases.detail.attachments.downloadSuccess'));
                this.schedule(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.errorMessage.set(this.transloco.translate('cases.detail.attachments.downloadError'));
                this.logger.error('CaseAttachmentsComponent', 'Error downloading file:', error);
                this.schedule(() => this.errorMessage.set(null), 5000);
            }
        });
    }

    requestDelete(attachmentId: string): void {
        this.confirmDeleteId.set(attachmentId);
        // Auto-cancel after 5 seconds if user doesn't confirm
        this.schedule(() => {
            if (this.confirmDeleteId() === attachmentId) {
                this.confirmDeleteId.set(null);
            }
        }, 5000);
    }

    cancelDelete(): void {
        this.confirmDeleteId.set(null);
    }

    confirmDelete(attachment: Attachment): void {
        this.attachmentService.deleteAttachment(this.caseId(), attachment.id).pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe({
            next: () => {
                this.attachments.update(list => list.filter(a => a.id !== attachment.id));
                this.successMessage.set(this.transloco.translate('cases.detail.attachments.deleteSuccess'));
                this.confirmDeleteId.set(null);
                this.schedule(() => this.successMessage.set(null), 3000);
            },
            error: (error) => {
                this.errorMessage.set(this.transloco.translate('cases.detail.attachments.deleteError'));
                this.logger.error('CaseAttachmentsComponent', 'Error deleting attachment:', error);
                this.schedule(() => this.errorMessage.set(null), 5000);
            }
        });
    }

    formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatDate(date: string): string {
        const lang = this.transloco.getActiveLang();
        return new Date(date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    triggerFileUpload(): void {
        this.fileInput?.nativeElement.click();
    }
}