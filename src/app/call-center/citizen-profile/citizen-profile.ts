import { CommonModule } from "@angular/common";
import { Component, inject, signal, DestroyRef } from "@angular/core";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CitizenService } from "../../../core/services/citizen.service";
import { CaseService } from "../../../core/services/case.service";
import { CitizenProfile as CitizenProfileData, CaseSummary } from "../../../core/models/citizen.models";
import { TranslocoModule, TranslocoService } from "@jsverse/transloco";
import { LoggerService } from "../../../core/services/logger.service";
import { CaseHistoryModalComponent } from "./case-history-modal/case-history-modal";

@Component({
  selector: 'app-citizen-profile',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule, CaseHistoryModalComponent],
  templateUrl: './citizen-profile.html',
  styleUrls: ['./citizen-profile.css']
})
export class CitizenProfile {
  private citizenService = inject(CitizenService);
  private caseService = inject(CaseService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private logger = inject(LoggerService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);

  protected readonly historyPageSize = 20;

  protected citizen = signal<CitizenProfileData | null>(null);
  protected isLoading = signal(true);
  protected errorMessage = signal<string | null>(null);

  protected historyOpen = signal(false);
  protected historyLoading = signal(false);
  protected historyError = signal<string | null>(null);
  protected historyCases = signal<CaseSummary[]>([]);
  protected historyCurrentPage = signal(0);
  protected historyTotalPages = signal(0);
  protected historyTotalElements = signal(0);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadCitizenProfile(id);
    } else {
      this.errorMessage.set(this.transloco.translate('citizenProfile.errors.idNotFound'));
      this.isLoading.set(false);
    }
  }

  private loadCitizenProfile(id: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.citizenService.getCitizenProfile(id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.citizen.set(response);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.logger.error('CitizenProfile', 'Error loading citizen profile:', error);
        this.errorMessage.set(this.transloco.translate('citizenProfile.errors.loadFailed'));
        this.isLoading.set(false);
      }
    });
  }

  createNewCase(): void {
    const citizen = this.citizen();
    if (citizen?.id) {
      // US-57: the citizen is handed over by ID in the URL (the same identifier
      // this profile route already carries) so the /cases page locks it
      // reliably — router extras.state is timing-fragile on lazy routes.
      // No national ID travels here: it is masked for AGENTs (US-56) and the
      // citizen-scoped endpoint resolves the citizen server-side.
      this.router.navigate(['/cases'], {
        queryParams: { tab: 'create', citizenId: citizen.id }
      });
    }
  }

  openHistory(): void {
    const citizen = this.citizen();
    if (!citizen?.id) {
      return;
    }
    this.historyOpen.set(true);
    this.loadHistoryPage(0);
  }

  closeHistory(): void {
    this.historyOpen.set(false);
  }

  onHistoryPageChanged(page: number): void {
    this.loadHistoryPage(page);
  }

  openCaseFromHistory(caseId: string): void {
    this.closeHistory();
    this.openCaseDetail(caseId);
  }

  openCaseDetail(caseId: string): void {
    this.router.navigate(['/cases', caseId]);
  }

  private loadHistoryPage(page: number): void {
    const citizenId = this.citizen()?.id;
    if (!citizenId) {
      return;
    }
    this.historyLoading.set(true);
    this.historyError.set(null);

    this.caseService.getCitizenCaseHistory(citizenId, page, this.historyPageSize).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.historyCases.set(response.content);
        this.historyCurrentPage.set(response.page);
        this.historyTotalPages.set(response.totalPages);
        this.historyTotalElements.set(response.totalElements);
        this.historyLoading.set(false);
      },
      error: (error) => {
        this.logger.error('CitizenProfile', 'Error loading case history:', error);
        this.historyError.set(this.transloco.translate('citizenProfile.history.loadError'));
        this.historyLoading.set(false);
      }
    });
  }

  departmentName(c: CaseSummary): string {
    return this.transloco.getActiveLang() === 'ar'
      ? (c.departmentNameAr || c.departmentNameEn || '—')
      : (c.departmentNameEn || c.departmentNameAr || '—');
  }

  goBack(): void {
    this.router.navigate(['/app/call-center']);
  }

  getStatusBadgeClass(status: string): string {
    const statusMap: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-800',
      'ASSIGNED': 'bg-purple-100 text-purple-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'AWAITING_INFO': 'bg-orange-100 text-orange-800',
      'SUSPENDED': 'bg-gray-100 text-gray-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-200 text-gray-800',
      'CANCELLED': 'bg-red-100 text-red-800'
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  }
}
