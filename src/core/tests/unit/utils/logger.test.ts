/**
 * Debug logger — createLogger, setDebugEnabled, isDebugEnabled, log/warn/error behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogger, createGeokitLogger, geokitTag } from '../../../src/utils/logger';

const FLAG = '__TEST_LOGGER_DEBUG__';

function getWindow(): Record<string, boolean | undefined> {
  return typeof window !== 'undefined'
    ? (window as unknown as Record<string, boolean | undefined>)
    : (globalThis as unknown as Record<string, boolean | undefined>);
}

describe('logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const win = getWindow();
    delete win[FLAG];
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    const win = getWindow();
    delete win[FLAG];
  });

  describe('createLogger', () => {
    it('should return debug, setDebugEnabled, and isDebugEnabled', () => {
      const logger = createLogger({ windowFlag: FLAG });
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug.log).toBe('function');
      expect(typeof logger.debug.warn).toBe('function');
      expect(typeof logger.debug.error).toBe('function');
      expect(typeof logger.setDebugEnabled).toBe('function');
      expect(typeof logger.isDebugEnabled).toBe('function');
    });

    it('should default windowFlag to __DEBUG__ when not provided', () => {
      const logger = createLogger();
      logger.setDebugEnabled(true);
      expect(logger.isDebugEnabled()).toBe(true);
      logger.setDebugEnabled(false);
    });
  });

  describe('setDebugEnabled / isDebugEnabled', () => {
    it('should be disabled by default', () => {
      const logger = createLogger({ windowFlag: FLAG });
      expect(logger.isDebugEnabled()).toBe(false);
    });

    it('should enable debug when setDebugEnabled(true)', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      expect(logger.isDebugEnabled()).toBe(true);
    });

    it('should disable debug when setDebugEnabled(false)', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.setDebugEnabled(false);
      expect(logger.isDebugEnabled()).toBe(false);
    });

    it('should sync window flag when setDebugEnabled is called', () => {
      const logger = createLogger({ windowFlag: FLAG });
      const win = getWindow();
      logger.setDebugEnabled(true);
      expect(win[FLAG]).toBe(true);
      logger.setDebugEnabled(false);
      expect(win[FLAG]).toBe(false);
    });

    it('should reflect window flag when isDebugEnabled is called', () => {
      const logger = createLogger({ windowFlag: FLAG });
      const win = getWindow();
      win[FLAG] = true;
      expect(logger.isDebugEnabled()).toBe(true);
      win[FLAG] = false;
      expect(logger.isDebugEnabled()).toBe(false);
    });
  });

  describe('debug.log / debug.warn', () => {
    it('should not call console.log when debug is disabled', () => {
      getWindow()[FLAG] = false;
      const logger = createLogger({ windowFlag: FLAG });
      logger.debug.log('msg', 1);
      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should call console.log when debug is enabled', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('hello', 42);
      expect(logSpy).toHaveBeenCalledWith('hello', 42);
    });

    it('should not call console.warn when debug is disabled', () => {
      getWindow()[FLAG] = false;
      const logger = createLogger({ windowFlag: FLAG });
      logger.debug.warn('warn');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('should call console.warn when debug is enabled', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.warn('warn');
      expect(warnSpy).toHaveBeenCalledWith('warn');
    });
  });

  describe('debug.error', () => {
    it('should always call console.error regardless of debug flag', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.debug.error('err');
      expect(errorSpy).toHaveBeenCalledWith('err');
      errorSpy.mockClear();
      logger.setDebugEnabled(true);
      logger.debug.error('err2');
      expect(errorSpy).toHaveBeenCalledWith('err2');
    });
  });

  describe('geokitTag / scoped logger', () => {
    it('geokitTag normalizes scope to [gk-<scope>]', () => {
      expect(geokitTag('h3')).toBe('[gk-h3]');
      expect(geokitTag('gk-map')).toBe('[gk-map]');
    });

    it('createGeokitLogger prefixes log messages when debug is enabled', () => {
      const logger = createGeokitLogger('h3', { windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('viewport cells', 3);
      expect(logSpy).toHaveBeenCalledWith('[gk-h3] viewport cells', 3);
    });

    it('does not double-prefix messages that already include a gk tag', () => {
      const logger = createGeokitLogger('h3', { windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('[gk-map] already tagged');
      expect(logSpy).toHaveBeenCalledWith('[gk-map] already tagged');
    });
  });

});
