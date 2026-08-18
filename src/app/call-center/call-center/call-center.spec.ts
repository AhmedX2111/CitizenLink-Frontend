import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';

import { CallCenter } from './call-center';
import { CitizenService } from '../../../core/services/citizen.service';
import { LoggerService } from '../../../core/services/logger.service';
import { PagedResponse } from '../../../core/models/case.models';
import { Citizen } from '../../../core/models/citizen.models';

describe('CallCenter', () => {
  let component: CallCenter;
  let fixture: ComponentFixture<CallCenter>;

  let citizenService: { searchCitizens: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  const paged = (page: number): PagedResponse<Citizen> => ({
    content: [],
    totalElements: 0,
    totalPages: 1,
    page,
    size: 20,
    first: page === 0,
    last: page === 0
  } as PagedResponse<Citizen>);

  beforeEach(async () => {
    citizenService = { searchCitizens: vi.fn().mockReturnValue(of(paged(0))) };
    logger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CallCenter],
      providers: [
        { provide: CitizenService, useValue: citizenService },
        { provide: LoggerService, useValue: logger },
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

    fixture = TestBed.createComponent(CallCenter);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  const loadPage = (page: number): void => {
    (component as unknown as { loadPage: (p: number) => void }).loadPage(page);
  };

  const searchTerm = (): string => (component as unknown as { searchTerm: () => string }).searchTerm();
  const setSearchTerm = (term: string): void => {
    (component as unknown as { searchTerm: { set: (v: string) => void } }).searchTerm.set(term);
  };
  const errorMessage = (): string | null => (component as unknown as { errorMessage: () => string | null }).errorMessage();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('sets an error message when a page load fails (M-30)', () => {
    citizenService.searchCitizens.mockReturnValue(throwError(() => ({ status: 500 })));
    setSearchTerm('jane');
    fixture.detectChanges();

    loadPage(2);

    expect(errorMessage()).toBe('callCenter.errors.searchFailed');
    expect(logger.error).toHaveBeenCalled();
  });

  it('passes the trimmed search term when loading a page (M-30)', () => {
    setSearchTerm('  jane  ');
    fixture.detectChanges();

    loadPage(1);

    expect(citizenService.searchCitizens).toHaveBeenCalledWith('jane', 1, 20);
  });
});