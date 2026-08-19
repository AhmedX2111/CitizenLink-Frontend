import { Injectable, ErrorHandler, inject } from '@angular/core';
import { LoggerService } from './logger.service';

@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private logger = inject(LoggerService);

  handleError(error: unknown): void {
    this.logger.error('GlobalErrorHandler', 'Unhandled error:', error);
  }
}
