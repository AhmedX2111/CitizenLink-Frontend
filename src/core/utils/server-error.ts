import type { LoggerService } from '../services/logger.service';

export interface ServerFieldError {
  field: string;
  message: string;
}

export interface ServerErrorBody {
  code?: string;
  message?: string;
  details?: ServerFieldError[];
  fieldErrors?: Record<string, string>;
  violations?: ServerFieldError[];
}

export interface ApiError {
  status?: number;
  error?: ServerErrorBody | string;
}

function extractBody(error: unknown): ServerErrorBody | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const body = (error as ApiError).error;
  if (!body || typeof body === 'string') return undefined;
  return body;
}

export function errorCode(error: unknown): string {
  return extractBody(error)?.code ?? '';
}

export function errorDetails(error: unknown): ServerFieldError[] {
  const body = extractBody(error);
  if (!body) return [];

  const details = body.details ?? body.violations;
  if (Array.isArray(details)) {
    return details.filter(
      (d): d is ServerFieldError => !!d && typeof d === 'object' && typeof d.field === 'string'
    );
  }

  if (body.fieldErrors && typeof body.fieldErrors === 'object') {
    return Object.entries(body.fieldErrors).map(([field, message]) => ({ field, message }));
  }

  return [];
}

export function fieldErrorsFromDetails(
  details: ServerFieldError[],
  fallbackKey: string
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const d of details) {
    map[d.field] = fallbackKey;
  }
  return map;
}

export function logServerError(logger: LoggerService, context: string, error: unknown): void {
  const body = extractBody(error);
  if (body) {
    logger.error(context, `Server error [${body.code ?? 'UNKNOWN'}]: ${body.message ?? ''}`, body);
  } else {
    logger.error(context, 'Server error:', error);
  }
}