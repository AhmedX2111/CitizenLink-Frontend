import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth.service';
import { errorCode } from '../../../core/utils/server-error';
import { Subscription } from 'rxjs';
import { filter, take } from 'rxjs/operators';

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
    this.returnUrl = this.route.snapshot.queryParams['returnUrl'] || null;
    this.subscriptions.add(
      this.authService.authState$
        .pipe(
          filter(user => !!user),
          take(1)
        )
        .subscribe(() => {
          const safeReturn = this.isSafeReturnUrl(this.returnUrl) ? this.returnUrl! : '/dashboard';
          this.router.navigateByUrl(safeReturn);
        })
    );
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
      this.authService.login({ username, password, rememberMe }).subscribe({
        next: () => {
          this.isLoading.set(false);
          const target = this.isSafeReturnUrl(this.returnUrl) ? this.returnUrl! : '/dashboard';
          this.router.navigateByUrl(target);
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
    const t = (key: string) => this.transloco.translate(key);
    if (error.status === 401) {
      // US-47: the backend guarantees the standard {code, message, details}
      // envelope on every security failure, so account state is detected from
      // the machine-readable code first. The legacy message-text regex remains
      // only as a fallback for non-standard bodies (e.g. plain-string bodies).
      const code = errorCode(error);
      const body = typeof error.error === 'string' ? error.error : error.error?.message ?? '';
      if (code === 'ACCOUNT_DISABLED' || code === 'ACCOUNT_LOCKED'
          || /disabled|inactive|deactivated|locked/i.test(body)) {
        this.errorMessage.set(t('login.errors.accountInactive'));
      } else {
        this.errorMessage.set(t('login.errors.invalidCredentials'));
      }
    } else {
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

  private isSafeReturnUrl(url: string | null): boolean {
    if (!url || url.trim() === '') return false;
    if (/^(https?:)?\/\//i.test(url)) return false;
    if (url.includes(':')) return false;
    if (!url.startsWith('/')) return false;
    return true;
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