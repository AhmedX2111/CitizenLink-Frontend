/*
 * NewCitizen spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - should create
 *   - successful submit redirects to the citizen profile after 2s
 *   - destroy cancels the redirect timer so it never yanks the user away (M-25)
 *   - server messages are never rendered: mapped to translation keys and logged (M-26)
 *
 * SKIPPED (with reason):
 *   - Validation/error-message matrix: exercised through the shared form helpers;
 *     kept minimal here because the component had no prior behavioural spec.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { NewCitizen } from './new-citizen';
import { CitizenService } from '../../../../core/services/citizen.service';
import { LoggerService } from '../../../../core/services/logger.service';

describe('NewCitizen', () => {
  let component: NewCitizen;
  let fixture: ComponentFixture<NewCitizen>;

  let citizenService: { createCitizen: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };
  let logger: { error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    citizenService = { createCitizen: vi.fn().mockReturnValue(of({ id: 7, fullName: 'Test Citizen' })) };
    router = { navigate: vi.fn() };
    logger = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewCitizen],
      providers: [
        { provide: CitizenService, useValue: citizenService },
        { provide: Router, useValue: router },
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

    fixture = TestBed.createComponent(NewCitizen);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const fillValidForm = (): void => {
    (component as unknown as { citizenForm: { patchValue: (v: unknown) => void } }).citizenForm.patchValue({
      fullName: 'Test Citizen',
      nationalId: '1234567890123456',
      phone: '01234567890',
      email: 'test@example.com',
      preferredLanguage: 'en'
    });
  };

  const errorMessage = (): string | null =>
    (component as unknown as { errorMessage: () => string | null }).errorMessage();

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('redirects to the created citizen profile after 2 seconds', () => {
    vi.useFakeTimers();
    fillValidForm();

    component.onSubmit();

    expect(citizenService.createCitizen).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2000);
    expect(router.navigate).toHaveBeenCalledWith(['/app/call-center/citizen', 7]);
  });

  it('cancels the redirect timer on destroy so it never yanks the user away (M-25)', () => {
    vi.useFakeTimers();
    fillValidForm();

    component.onSubmit();
    fixture.destroy();

    vi.advanceTimersByTime(2000);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('maps a 400 field error to the validation key and logs the raw message (M-26)', () => {
    citizenService.createCitizen.mockReturnValue(
      throwError(() => ({ status: 400, error: { fieldErrors: { nationalId: 'National ID must match the registry' } } }))
    );
    fillValidForm();

    component.onSubmit();

    expect(errorMessage()).toBe('newCitizen.errors.validationFailed');
    expect(logger.error).toHaveBeenCalled();
  });

  it('maps a 409 to the duplicate key and logs the server message (M-26)', () => {
    citizenService.createCitizen.mockReturnValue(
      throwError(() => ({ status: 409, error: { code: 'DUPLICATE_RESOURCE', message: 'citizen already exists' } }))
    );
    fillValidForm();

    component.onSubmit();

    expect(errorMessage()).toBe('newCitizen.errors.duplicate');
    expect(errorMessage()).not.toBe('citizen already exists');
    expect(logger.error).toHaveBeenCalled();
  });

  it('maps an arbitrary message error to the unexpected key and logs the server message (M-26)', () => {
    citizenService.createCitizen.mockReturnValue(
      throwError(() => ({ error: { message: 'Database constraint violation' } }))
    );
    fillValidForm();

    component.onSubmit();

    expect(errorMessage()).toBe('newCitizen.errors.unexpected');
    expect(errorMessage()).not.toBe('Database constraint violation');
    expect(logger.error).toHaveBeenCalled();
  });
});