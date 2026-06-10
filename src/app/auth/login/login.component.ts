// src/app/auth/login/login.component.ts

import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { Subscription, timeout, catchError } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  loginForm: FormGroup;
  
  // Using signals for reactive state
  protected readonly isLoading = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected returnUrl: string | null = null;
  
  private subscriptions: Subscription = new Subscription();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      username: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    // Redirect if already logged in
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.getRoleRoute()]);
      return;
    }

    // Get return URL from route parameters
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.markFormGroupTouched(this.loginForm);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    
    const { username, password, rememberMe } = this.loginForm.value;
    
    const loginSub = this.authService.login({ username, password }, rememberMe)
      .subscribe({
        next: (response) => {
          this.isLoading.set(false);
          const destination = this.returnUrl ?? this.getRoleRoute();
          this.router.navigate([destination]);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.handleLoginError(error);
        }
      });
    
    this.subscriptions.add(loginSub);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(value => !value);
  }

  private handleLoginError(error: any): void {
    console.error('Full error object:', error);
    
    if (error.status === 0) {
      this.errorMessage.set('Cannot connect to server. Please make sure the backend is running on port 8080.');
    } else if (error.status === 401) {
      this.errorMessage.set('Invalid username or password. Please try again.');
    } else if (error.status === 400) {
      this.errorMessage.set('Please check your credentials and try again.');
    } else if (error.status === 403) {
      this.errorMessage.set('Your account is inactive. Please contact support.');
    } else if (error.status === 404) {
      this.errorMessage.set('API endpoint not found. Please check if the backend is correctly configured.');
    } else if (error.status === 500) {
      this.errorMessage.set('Server error. Please try again later or contact support.');
    } else {
      this.errorMessage.set(`Error: ${error.status} - ${error.statusText || 'An unexpected error occurred'}`);
    }
    
    // Clear password field on error
    this.loginForm.patchValue({ password: '' });
    this.loginForm.get('password')?.markAsUntouched();
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.values(formGroup.controls).forEach(control => {
      control.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }

  private getRoleRoute(): string {
  const role = this.authService.getRoleFromToken();
  switch (role) {
    case 'ADMIN':
    case 'SUPERVISOR': return '/dashboard';
    case 'HANDLER':    return '/cases';
    case 'AGENT':      return '/cases';
    default:           return '/login';
  }
}

  // Getters for form controls
  get username() { return this.loginForm.get('username'); }
  get password() { return this.loginForm.get('password'); }
  get rememberMe() { return this.loginForm.get('rememberMe'); }
}