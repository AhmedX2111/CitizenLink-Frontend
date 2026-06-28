import { ApplicationConfig, provideZoneChangeDetection, isDevMode, ErrorHandler } from '@angular/core';
import { provideRouter } from '@angular/router';
import {
  provideHttpClient,
  withInterceptors,
  HttpClient
} from '@angular/common/http';
import { authInterceptor } from './auth/auth.interceptor';
import { httpErrorInterceptor } from '../core/services/http-error.interceptor';
import { GlobalErrorHandler } from '../core/services/error-handler.service';
import { routes } from './app.routes';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class TranslocoHttpLoader implements TranslocoLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string) {
    return this.http.get<Record<string, unknown>>(
      `/assets/i18n/${lang}.json`
    );
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor, httpErrorInterceptor])
    ),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideTransloco({
      config: {
        availableLangs: ['en', 'ar'],
        defaultLang: 'en',
        fallbackLang: 'en',
        reRenderOnLangChange: true,
        prodMode: !isDevMode()
      },
      loader: TranslocoHttpLoader
    })
  ]
};