import { Injectable, isDevMode } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class LoggerService {
  private isDev: boolean;

  constructor() {
    this.isDev = isDevMode();
  }

  /** Overrides the environment-derived dev flag (used by unit tests). */
  setDevMode(value: boolean): void {
    this.isDev = value;
  }

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
    console.error(`[${context}] ${message}`, ...data);
  }
}
