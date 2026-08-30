import { describe, it, expect, vi } from 'vitest';
import {
  errorCode,
  errorDetails,
  fieldErrorsFromDetails,
  logServerError,
} from './server-error';

describe('server-error', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the error code from the standard envelope', () => {
    expect(errorCode({ error: { code: 'DUPLICATE_RESOURCE' } })).toBe('DUPLICATE_RESOURCE');
    expect(errorCode({ error: {} })).toBe('');
    expect(errorCode({ status: 500 })).toBe('');
    expect(errorCode(null)).toBe('');

    const asString = errorCode({ error: 'plain text' } as unknown as object);
    expect(asString).toBe('');
  });

  // US-47: the exact security envelope shapes the backend emits
  it('parses the standard security envelope codes (US-47)', () => {
    const securityCodes = ['UNAUTHORIZED', 'BAD_CREDENTIALS', 'ACCOUNT_DISABLED', 'ACCOUNT_LOCKED', 'FORBIDDEN', 'NOT_FOUND', 'INVALID_TRANSITION', 'INTERNAL_ERROR'];
    for (const code of securityCodes) {
      expect(errorCode({
        error: { code, message: 'Fixed message', details: null },
      })).toBe(code);
    }
  });

  it('yields no details when the security envelope carries details: null (US-47)', () => {
    expect(errorDetails({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required', details: null },
    })).toEqual([]);
    expect(errorDetails({
      error: { code: 'FORBIDDEN', message: 'Access denied', details: null },
    })).toEqual([]);
  });

  it('extracts details from the details array', () => {
    const details = errorDetails({
      error: { details: [{ field: 'email', message: 'Email must be valid' }] },
    });
    expect(details).toEqual([{ field: 'email', message: 'Email must be valid' }]);
  });

  it('falls back to legacy violations and fieldErrors shapes', () => {
    expect(errorDetails({ error: { violations: [{ field: 'role', message: 'Role is required' }] } }))
      .toEqual([{ field: 'role', message: 'Role is required' }]);

    expect(errorDetails({ error: { fieldErrors: { 'nameEn': 'English name is required' } } }))
      .toEqual([{ field: 'nameEn', message: 'English name is required' }]);
  });

  it('returns no details when the error payload is absent or malformed', () => {
    expect(errorDetails({ status: 500 })).toEqual([]);
    expect(errorDetails({ error: 'plain text' } as unknown as object)).toEqual([]);
    expect(errorDetails(null)).toEqual([]);
  });

  it('maps details to a field keys map using a single fallback key', () => {
    const map = fieldErrorsFromDetails(
      [{ field: 'email', message: 'Email must be valid' }],
      'validation.key'
    );
    expect(map).toEqual({ email: 'validation.key' });
  });

  it('logs the raw server message and code without touching the screen', () => {
    logServerError(logger as never, 'Test', {
      error: { code: 'VALIDATION_ERROR', message: 'Validation failed' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Test',
      'Server error [VALIDATION_ERROR]: Validation failed',
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
  });

  it('logs the raw error when the payload has no message', () => {
    logServerError(logger as never, 'Test', { status: 500 });
    expect(logger.error).toHaveBeenCalledWith('Test', 'Server error:', expect.anything());
  });
});