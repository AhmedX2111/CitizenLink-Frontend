import { CommonModule } from '@angular/common';
import { Component, inject, signal, DestroyRef, OnDestroy } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CitizenService } from '../../../../core/services/citizen.service';
import { LoggerService } from '../../../../core/services/logger.service';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';

@Component({
  selector: 'app-new-citizen',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslocoModule],
  templateUrl: './new-citizen.html',
  styleUrl: './new-citizen.css',
})
export class NewCitizen implements OnDestroy {

  private fb = inject(FormBuilder);
  private citizenService = inject(CitizenService);
  private router = inject(Router);
  private logger = inject(LoggerService);
  private transloco = inject(TranslocoService);
  private destroyRef = inject(DestroyRef);
  private timers = new Set<ReturnType<typeof setTimeout>>();

  protected citizenForm: FormGroup;
  protected isLoading = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  constructor() {
    this.citizenForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      nationalId: ['', [Validators.required, Validators.pattern('^[0-9]{16}$')]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{11}$')]],
      email: ['', [Validators.pattern('^[A-Za-z0-9+_.-]+@(.+)$')]],
      preferredLanguage: ['en', Validators.required]
    });
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

  onSubmit(): void {
    if (this.citizenForm.invalid) {
        this.markFormGroupTouched(this.citizenForm);
        return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const formValue = this.citizenForm.value;
    
    const request = {
        fullName: formValue.fullName,
        nationalId: formValue.nationalId,
        phone: formValue.phone,
        email: formValue.email && formValue.email.trim() !== '' ? formValue.email : null,
        preferredLanguage: formValue.preferredLanguage
    };

    this.citizenService.createCitizen(request).pipe(
        takeUntilDestroyed(this.destroyRef)
    ).subscribe({
        next: (response) => {
            this.isLoading.set(false);
            this.successMessage.set(
                this.transloco.translate('newCitizen.successMessage', { fullName: response.fullName })
            );
            
            this.schedule(() => {
                this.router.navigate(['/app/call-center/citizen', response.id]);
            }, 2000);
        },
        error: (error) => {
            this.isLoading.set(false);
            this.logger.error('NewCitizen', 'Create citizen error:', error);
            
            if (error.status === 400 && error.error?.fieldErrors) {
                const fieldErrors = error.error.fieldErrors;
                const firstError = Object.values(fieldErrors)[0];
                this.errorMessage.set(this.transloco.translate('newCitizen.errors.validationFailed'));
                this.logger.error('NewCitizen', 'Create citizen validation failed:', firstError ?? error);
            } else if (error.status === 409) {
                this.errorMessage.set(this.transloco.translate('newCitizen.errors.duplicate'));
                this.logger.error('NewCitizen', 'Create citizen failed (409):', error.error?.message ?? error);
            } else if (error.error?.message) {
                this.errorMessage.set(this.transloco.translate('newCitizen.errors.unexpected'));
                this.logger.error('NewCitizen', 'Create citizen failed:', error.error.message);
            } else {
                this.errorMessage.set(this.transloco.translate('newCitizen.errors.unexpected'));
                this.logger.error('NewCitizen', 'Create citizen failed:', error);
            }
        }
    });
  }

  cancel(): void {
    this.router.navigate(['/app/call-center']);
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  protected onlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  get fullName() { return this.citizenForm.get('fullName'); }
  get nationalId() { return this.citizenForm.get('nationalId'); }
  get phone() { return this.citizenForm.get('phone'); }
  get email() { return this.citizenForm.get('email'); }
  get preferredLanguage() { return this.citizenForm.get('preferredLanguage'); }
}
