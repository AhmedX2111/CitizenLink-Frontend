import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LoggerService } from './logger.service';

describe('LoggerService', () => {
  let log: (...args: unknown[]) => unknown;
  let warn: (...args: unknown[]) => unknown;
  let error: (...args: unknown[]) => unknown;

  beforeEach(() => {
    log = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => void log(...args));
    vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => void warn(...args));
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => void error(...args));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('errors always log, even in production', () => {
    const logger = new LoggerService();
    logger.setDevMode(false);

    logger.error('Context', 'Something broke', { detail: 1 });

    expect(error).toHaveBeenCalledWith('[Context] Something broke', { detail: 1 });
  });

  it('gates info and warn in production', () => {
    const logger = new LoggerService();
    logger.setDevMode(false);

    logger.info('Context', 'info message');
    logger.warn('Context', 'warn message');

    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs info and warn in dev mode', () => {
    const logger = new LoggerService();
    logger.setDevMode(true);

    logger.info('Context', 'info message');
    logger.warn('Context', 'warn message');
    logger.error('Context', 'error message');

    expect(log).toHaveBeenCalledWith('[Context] info message');
    expect(warn).toHaveBeenCalledWith('[Context] warn message');
    expect(error).toHaveBeenCalledWith('[Context] error message');
  });
});