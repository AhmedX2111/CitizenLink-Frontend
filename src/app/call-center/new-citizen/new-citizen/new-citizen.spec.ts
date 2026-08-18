/*
 * NewCitizen spec — Vitest / Angular unit-test builder
 *
 * COVERED:
 *   - should create
 *   - successful submit redirects to the citizen profile after 2s
 *   - destroy cancels the redirect timer so it never yanks the user away (M-25)
 *
 * SKIPPED (with reason):
 *   - Validation/error-message matrix: exercised through the shared form helpers;
 *     kept minimal here because the component had no prior behavioural spec.
 */

import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';

import { NewCitizen } from './new-citizen';
import { CitizenService } from '../../../../core/services/citizen.service';

describe('NewCitizen', () => {
  let component: NewCitizen;
  let fixture: ComponentFixture<NewCitizen>;

  let citizenService: { createCitizen: ReturnType<typeof vi.fn> };
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    citizenService = { createCitizen: vi.fn().mockReturnValue(of({ id: 7, fullName: 'Test Citizen' })) };
    router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [NewCitizen],
      providers: [
        { provide: CitizenService, useValue: citizenService },
        { provide: Router, useValue: router },
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
});