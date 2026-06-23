import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [CommonModule, ReactiveFormsModule, RouterModule, TranslocoModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class Login implements OnInit, OnDestroy {

  private transloco = inject(TranslocoService);

  loginForm: FormGroup;
  protected readonly isLoading     = signal(false);
  protected readonly showPassword   = signal(false);
  protected readonly errorMessage   = signal<string | null>(null);
  protected returnUrl: string | null = null;
  private subscriptions             = new Subscription();

  constructor(
    private fb:          FormBuilder,
    private authService: AuthService,
    private router:      Router,
    private route:       ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      username:   ['', Validators.required],
      password:   ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false]
    });
  }

  ngOnInit(): void {
    if (this.authService.isAuthenticated()) {
      this.router.navigate([this.getRoleRoute()]);
      return;
    }
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
    this.subscriptions.add(
      this.authService.login({ username, password }, rememberMe).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.router.navigate([this.returnUrl ?? this.getRoleRoute()]);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.handleLoginError(error);
        }
      })
    );
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  private handleLoginError(error: any): void {
    if (error.status === 401) {
      this.errorMessage.set('Invalid username or password. Please try again.');
    } else {
      const t = (key: string) => this.transloco.translate(key);
      const keyMap: Record<number, string> = {
        0:   'login.errors.connectionFailed',
        400: 'login.errors.badRequest',
        403: 'login.errors.accountInactive',
        404: 'login.errors.endpointNotFound',
        500: 'login.errors.serverError'
      };
      this.errorMessage.set(
        keyMap[error.status]
          ? t(keyMap[error.status])
          : `${t('login.errors.unknown')}: ${error.status}`
      );
    }
    this.loginForm.patchValue({ password: '' });
    this.loginForm.get('password')?.markAsUntouched();
  }

  private getRoleRoute(): string {
    const role = this.authService.getRoleFromToken();
    switch (role) {
      case 'ADMIN':
      case 'SUPERVISOR': 
      case 'HANDLER':
      case 'AGENT':      return '/dashboard';
      default:           return '/login';
    }
  }

  private markFormGroupTouched(fg: FormGroup): void {
    Object.values(fg.controls).forEach(c => {
      c.markAsTouched();
      if (c instanceof FormGroup) this.markFormGroupTouched(c);
    });
  }

  get username()   { return this.loginForm.get('username'); }
  get password()   { return this.loginForm.get('password'); }
  get rememberMe() { return this.loginForm.get('rememberMe'); }
}