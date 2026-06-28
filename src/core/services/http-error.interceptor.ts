import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { LoggerService } from './logger.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        logger.error('HttpErrorInterceptor', 'Network error / no response');
      } else if (error.status >= 500) {
        logger.error('HttpErrorInterceptor', `Server error ${error.status}:`, error.message);
      }
      return throwError(() => error);
    })
  );
};
