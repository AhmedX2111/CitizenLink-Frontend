import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { CitizenService } from '../../../../core/services/citizen.service';

@Component({
  selector: 'app-new-citizen',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './new-citizen.html',
  styleUrl: './new-citizen.css',
})
export class NewCitizen {

  private fb = inject(FormBuilder);
  private citizenService = inject(CitizenService);
  private router = inject(Router);

  protected citizenForm: FormGroup;
  protected isLoading = signal(false);
  protected errorMessage = signal<string | null>(null);
  protected successMessage = signal<string | null>(null);

  constructor() {
    this.citizenForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(200)]],
      nationalId: ['', [Validators.required, Validators.pattern('^[0-9]{10}$')]],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{11}$')]],
      email: ['', [Validators.pattern('^[A-Za-z0-9+_.-]+@(.+)$')]],
      preferredLanguage: ['en', Validators.required]
    });
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
    
    // Send null instead of empty string for email
    const request = {
        fullName: formValue.fullName,
        nationalId: formValue.nationalId,
        phone: formValue.phone,
        email: formValue.email && formValue.email.trim() !== '' ? formValue.email : null,
        preferredLanguage: formValue.preferredLanguage
    };

    this.citizenService.createCitizen(request).subscribe({
        next: (response) => {
            this.isLoading.set(false);
            this.successMessage.set(`Citizen "${response.fullName}" created successfully!`);
            
            setTimeout(() => {
                this.router.navigate(['/app/call-center/citizen', response.id]);
            }, 2000);
        },
        error: (error) => {
            this.isLoading.set(false);
            console.error('Create citizen error:', error);
            
            if (error.status === 400 && error.error?.fieldErrors) {
                const fieldErrors = error.error.fieldErrors;
                const firstError = Object.values(fieldErrors)[0];
                this.errorMessage.set(firstError as string);
            } else if (error.status === 409) {
                this.errorMessage.set(error.error?.message || 'Citizen with this information already exists');
            } else if (error.error?.message) {
                this.errorMessage.set(error.error.message);
            } else {
                this.errorMessage.set('An error occurred while creating the citizen. Please try again.');
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
    // Allow only numbers (0-9)
    if (charCode < 48 || charCode > 57) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  // Getters for form controls
  get fullName() { return this.citizenForm.get('fullName'); }
  get nationalId() { return this.citizenForm.get('nationalId'); }
  get phone() { return this.citizenForm.get('phone'); }
  get email() { return this.citizenForm.get('email'); }
  get preferredLanguage() { return this.citizenForm.get('preferredLanguage'); }
}
