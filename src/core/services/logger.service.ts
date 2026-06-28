import { Injectable, isDevMode } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private isDev = isDevMode();

  info(context: string, message: string, ...data: unknown[]): void {
    if (this.isDev) {
      console.log(`[${context}] ${message}`, ...data);
    }
  }

  warn(context: string, message: string, ...data: unknown[]): void {
    if (this.isDev) {
      console.warn(`[${context}] ${message}`, ...data);
    }
  }

  error(context: string, message: string, ...data: unknown[]): void {
    if (this.isDev) {
      console.error(`[${context}] ${message}`, ...data);
    }
  }
}
