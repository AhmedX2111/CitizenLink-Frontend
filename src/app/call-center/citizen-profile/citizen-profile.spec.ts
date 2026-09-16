import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';

import { CitizenProfile } from './citizen-profile';
import { CitizenService } from '../../../core/services/citizen.service';
import { CaseService } from '../../../core/services/case.service';
import { LoggerService } from '../../../core/services/logger.service';
import { PagedResponse } from '../../../core/models/case.models';
import { CitizenProfile as CitizenProfileData, CaseSummary } from '../../../core/models/citizen.models';

describe('CitizenProfile', () => {
  let component: CitizenProfile;
  let fixture: ComponentFixture<CitizenProfile>;

  let citizenService: { getCitizenProfile: ReturnType<typeof vi.fn> };
  let caseService: { getCitizenCaseHistory: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  const recentCase = (): CaseSummary => ({
    id: 'case-1',
    caseNumber: 'CS-001',
    subject: 'Broken water pipe',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-05T14:30:00Z',
    assignedToName: 'Ahmed Ali',
    departmentNameEn: 'Housing',
    departmentNameAr: 'الإسكان'
  });

  const profile = (overrides: Partial<CitizenProfileData> = {}): CitizenProfileData => ({
    id: 'cid-1',
    fullName: 'Salem Hassan',
    nationalId: '1111111111111111',
    phone: '0500000000',
    email: 'salem@example.com',
    preferredLanguage: 'ar',
    createdAt: '2026-01-01T08:00:00Z',
    lastContact: '2026-08-01T12:00:00Z',
    createdByUserName: 'Sara',
    totalCases: 7,
    openCases: 3,
    resolvedCases: 4,
    recentCases: [recentCase()],
    ...overrides
  });

  const historyPaged = (page: number): PagedResponse<CaseSummary> => ({
    content: [recentCase()],
    totalElements: 7,
    totalPages: 2,
    page,
    size: 20,
    first: page === 0,
    last: page === 1
  });

  beforeEach(async () => {
    citizenService = { getCitizenProfile: vi.fn().mockReturnValue(of(profile())) };
    caseService = { getCitizenCaseHistory: vi.fn().mockReturnValue(of(historyPaged(0))) };
    router = { navigate: vi.fn() };
    logger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CitizenProfile],
      providers: [
        { provide: CitizenService, useValue: citizenService },
        { provide: CaseService, useValue: caseService },
        { provide: LoggerService, useValue: logger },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: (key: string) => (key === 'id' ? 'cid-1' : null) } } }
        },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            setActiveLang: () => undefined,
            getActiveLang: () => 'en',
            config: { reRenderOnLangChange: false },
            langChanges$: of('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();
  });

  const createFixture = (): void => {
    fixture = TestBed.createComponent(CitizenProfile);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  const buttonByText = (text: string): HTMLButtonElement => {
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    return buttons.find((b) => b.textContent?.includes(text))!;
  };

  it('should create and load the profile using the route id', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    expect(component).toBeTruthy();
    expect(citizenService.getCitizenProfile).toHaveBeenCalledWith('cid-1');
    expect(fixture.nativeElement.textContent).toContain('Salem Hassan');
  });

  it('sets an error message when the profile fails to load', () => {
    citizenService.getCitizenProfile.mockReturnValue(throwError(() => ({ status: 404 })));
    createFixture();

    expect(fixture.nativeElement.textContent).toContain('citizenProfile.errors.loadFailed');
    expect(logger.error).toHaveBeenCalled();
  });

  it('renders the 5 case columns with department and last updated values', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    const html = fixture.nativeElement.textContent;
    expect(html).toContain('citizenProfile.caseTable.department');
    expect(html).toContain('citizenProfile.caseTable.lastUpdated');
    expect(html).toContain('Housing');
    expect(html).toContain('Aug 5, 2026');
  });

  it('opens the case history modal and loads page 0 when View All is clicked', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    buttonByText('citizenProfile.viewAll').click();
    fixture.detectChanges();

    expect(caseService.getCitizenCaseHistory).toHaveBeenCalledWith('cid-1', 0, 20);
    expect(fixture.nativeElement.textContent).toContain('citizenProfile.history.title');
    expect(fixture.nativeElement.textContent).toContain('CS-001');
  });

  it('disables View All when the citizen has no permitted cases', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile({ totalCases: 0, recentCases: [] })));
    createFixture();

    expect(buttonByText('citizenProfile.viewAll').disabled).toBe(true);
  });

  it('loads the next page when the modal next-page button is clicked', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    buttonByText('citizenProfile.viewAll').click();
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const nextButton = buttons.find((b) => b.textContent?.trim() === 'chevron_right')!;
    nextButton.click();

    expect(caseService.getCitizenCaseHistory).toHaveBeenLastCalledWith('cid-1', 1, 20);
  });

  it('shows an error inside the modal when the history load fails', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    caseService.getCitizenCaseHistory.mockReturnValue(throwError(() => ({ status: 500 })));
    createFixture();

    buttonByText('citizenProfile.viewAll').click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('citizenProfile.history.loadError');
    expect(logger.error).toHaveBeenCalled();
  });

  it('closes the modal and navigates to the case when a modal row is clicked', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    buttonByText('citizenProfile.viewAll').click();
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('app-case-history-modal tbody tr') as NodeListOf<HTMLElement>;
    rows[0].click();

    expect((component as unknown as { historyOpen: () => boolean }).historyOpen()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-1']);
  });

  it('navigates to the case detail page when a recent-cases row is clicked', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr') as NodeListOf<HTMLElement>;
    rows[0].click();

    expect(router.navigate).toHaveBeenCalledWith(['/cases', 'case-1']);
  });

  it('departmentName returns the language-appropriate department name', () => {
    citizenService.getCitizenProfile.mockReturnValue(of(profile()));
    createFixture();

    expect(component.departmentName(recentCase())).toBe('Housing');
  });
});