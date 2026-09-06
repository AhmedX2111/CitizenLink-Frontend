import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';

import { CaseHistoryModalComponent } from './case-history-modal';
import { CaseSummary } from '../../../../core/models/citizen.models';

describe('CaseHistoryModalComponent', () => {
  let component: CaseHistoryModalComponent;
  let fixture: ComponentFixture<CaseHistoryModalComponent>;

  const caseSummary = (overrides: Partial<CaseSummary> = {}): CaseSummary => ({
    id: 'case-1',
    caseNumber: 'CS-001',
    subject: 'Broken water pipe',
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-05T14:30:00Z',
    assignedToName: 'Ahmed Ali',
    departmentNameEn: 'Housing',
    departmentNameAr: 'الإسكان',
    ...overrides
  });

  let mockLang = 'en';

  beforeEach(async () => {
    mockLang = 'en';
    await TestBed.configureTestingModule({
      imports: [CaseHistoryModalComponent],
      providers: [
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string) => key,
            getActiveLang: () => mockLang,
            config: { reRenderOnLangChange: false },
            langChanges$: of('en'),
            _loadDependencies: () => of(undefined)
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CaseHistoryModalComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders nothing when closed', () => {
    component.isOpen = false;
    component.cases = [caseSummary()];
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('table')).toBeNull();
  });

  it('renders the 5 AC columns and the row content when open', () => {
    component.isOpen = true;
    component.cases = [caseSummary()];
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('table')).not.toBeNull();
    expect(host.textContent).toContain('CS-001');
    expect(host.textContent).toContain('Broken water pipe');
    expect(host.textContent).toContain('cases.statuses.IN_PROGRESS');
    expect(host.textContent).toContain('Housing');
    expect(host.textContent).toContain('05 Aug 2026, ');
  });

  it('shows the loading spinner instead of the table while loading', () => {
    component.isOpen = true;
    component.isLoading = true;
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('citizenProfile.history.loading');
    expect(host.querySelector('table')).toBeNull();
  });

  it('shows the translated error message when loading fails', () => {
    component.isOpen = true;
    component.isLoading = false;
    component.loadError = 'citizenProfile.history.loadError';
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('citizenProfile.history.loadError');
  });

  it('shows the empty state when there are no cases', () => {
    component.isOpen = true;
    component.isLoading = false;
    component.cases = [];
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('citizenProfile.history.empty');
    expect(host.querySelector('table')).toBeNull();
  });

  it('emits closed when the close button is clicked', () => {
    component.isOpen = true;
    fixture.detectChanges();

    let emitted = false;
    component.closed.subscribe(() => (emitted = true));

    const host = fixture.nativeElement as HTMLElement;
    const closeButton = host.querySelector('button') as HTMLButtonElement;
    closeButton.click();

    expect(emitted).toBe(true);
  });

  it('emits closed when the backdrop itself is clicked', () => {
    component.isOpen = true;
    fixture.detectChanges();

    let emitted = false;
    component.closed.subscribe(() => (emitted = true));

    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    backdrop.dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe(true);
  });

  it('does not close when a click inside the panel bubbles to the backdrop', () => {
    component.isOpen = true;
    fixture.detectChanges();

    let emitted = false;
    component.closed.subscribe(() => (emitted = true));

    const backdrop = fixture.nativeElement.querySelector('.fixed.inset-0');
    const panel = backdrop.querySelector('.rounded-2xl');
    panel.dispatchEvent(new MouseEvent('click'));

    expect(emitted).toBe(false);
  });

  it('emits openCase when a row is clicked', () => {
    component.isOpen = true;
    component.cases = [caseSummary()];
    fixture.detectChanges();

    let opened = '';
    component.openCase.subscribe((id: string) => (opened = id));

    const row = fixture.nativeElement.querySelector('tbody tr');
    row.click();

    expect(opened).toBe('case-1');
  });

  it('emits the next page when the next-page button is clicked', () => {
    component.isOpen = true;
    component.cases = [caseSummary()];
    component.currentPage = 0;
    component.totalPages = 3;
    fixture.detectChanges();

    let requestedPage = -1;
    component.pageChanged.subscribe((p: number) => (requestedPage = p));

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const nextButton = buttons.find((b) => b.textContent?.trim() === 'chevron_right');
    nextButton!.click();

    expect(requestedPage).toBe(1);
  });

  it('emits the previous page when the prev-page button is clicked', () => {
    component.isOpen = true;
    component.cases = [caseSummary()];
    component.currentPage = 2;
    component.totalPages = 3;
    fixture.detectChanges();

    let requestedPage = -1;
    component.pageChanged.subscribe((p: number) => (requestedPage = p));

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const prevButton = buttons.find((b) => b.textContent?.trim() === 'chevron_left');
    prevButton!.click();

    expect(requestedPage).toBe(1);
  });

  it('ignores page changes outside [0, totalPages)', () => {
    component.isOpen = true;
    component.cases = [caseSummary()];
    component.currentPage = 0;
    component.totalPages = 1;
    fixture.detectChanges();

    let requestedPage = -1;
    component.pageChanged.subscribe((p: number) => (requestedPage = p));

    component.goToPage(-1);
    component.goToPage(0);
    component.goToPage(1);

    expect(requestedPage).toBe(0);
  });

  it('departmentName picks the English name by default', () => {
    expect(component.departmentName(caseSummary())).toBe('Housing');
  });

  it('departmentName picks the Arabic name when the language is Arabic', () => {
    mockLang = 'ar';
    expect(component.departmentName(caseSummary())).toBe('الإسكان');
  });
});