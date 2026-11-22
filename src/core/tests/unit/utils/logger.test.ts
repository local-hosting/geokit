/**
 * Debug logger — createLogger, setDebugEnabled, isDebugEnabled, pino-blanc routing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const pbSpy = vi.hoisted(() => ({
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
}));

vi.mock('@westlane/pino-blanc/browser', () => ({
  createBrowserLogger: vi.fn(() => ({
    child: pbSpy.child.mockImplementation(() => ({
      debug: pbSpy.debug,
      warn: pbSpy.warn,
      error: pbSpy.error,
      child: pbSpy.child,
    })),
    debug: pbSpy.debug,
    warn: pbSpy.warn,
    error: pbSpy.error,
  })),
}));

import { createLogger, createGeokitLogger, geokitNotify, geokitTag } from '../../../src/utils/logger';

const FLAG = '__TEST_LOGGER_DEBUG__';

function getWindow(): Record<string, boolean | undefined> {
  return typeof window !== 'undefined'
    ? (window as unknown as Record<string, boolean | undefined>)
    : (globalThis as unknown as Record<string, boolean | undefined>);
}

describe('logger', () => {
  beforeEach(() => {
    pbSpy.debug.mockClear();
    pbSpy.warn.mockClear();
    pbSpy.error.mockClear();
    pbSpy.child.mockClear();
    const win = getWindow();
    delete win[FLAG];
  });

  afterEach(() => {
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
  });

  describe('debug.log / debug.warn', () => {
    it('should not call pino-blanc when debug is disabled', () => {
      getWindow()[FLAG] = false;
      const logger = createLogger({ windowFlag: FLAG });
      logger.debug.log('msg', 1);
      expect(pbSpy.debug).not.toHaveBeenCalled();
    });

    it('should call pino-blanc debug when debug is enabled', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('hello', 42);
      expect(pbSpy.debug).toHaveBeenCalledWith('hello', { detail: 42 });
    });

    it('should call pino-blanc warn when debug is enabled', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.warn('warn');
      expect(pbSpy.warn).toHaveBeenCalledWith('warn');
    });
  });

  describe('debug.error', () => {
    it('should always call pino-blanc error regardless of debug flag', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.debug.error('err');
      expect(pbSpy.error).toHaveBeenCalledWith('err');
      pbSpy.error.mockClear();
      logger.setDebugEnabled(true);
      logger.debug.error('err2');
      expect(pbSpy.error).toHaveBeenCalledWith('err2');
    });
  });

  describe('geokitNotify', () => {
    it('always calls pino-blanc warn even when debug flag is off', () => {
      getWindow()[FLAG] = false;
      const notify = geokitNotify('api');
      notify.warn('rate limited', { attempt: 1 });
      expect(pbSpy.warn).toHaveBeenCalledWith('rate limited', { attempt: 1 });
    });
  });

  describe('geokitTag / scoped logger', () => {
    it('geokitTag normalizes scope to [gk-<scope>]', () => {
      expect(geokitTag('h3')).toBe('[gk-h3]');
      expect(geokitTag('gk-map')).toBe('[gk-map]');
    });

    it('createGeokitLogger emits plain msg (module tag is pino-blanc %md%)', () => {
      const logger = createGeokitLogger('h3', { windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('viewport cells', 3);
      expect(pbSpy.debug).toHaveBeenCalledWith('viewport cells', { detail: 3 });
    });

    it('strips legacy [gk-*] prefixes from message text', () => {
      const logger = createGeokitLogger('h3', { windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('[gk-map] already tagged');
      expect(pbSpy.debug).toHaveBeenCalledWith('already tagged');
    });

    it('strips [layer-styles] from message text', () => {
      const logger = createGeokitLogger('layer-styles', { windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('[layer-styles] glow layer ADD done');
      expect(pbSpy.debug).toHaveBeenCalledWith('glow layer ADD done');
    });

    it('strips [gk-map] from message when logger has no scope', () => {
      const logger = createLogger({ windowFlag: FLAG });
      logger.setDebugEnabled(true);
      logger.debug.log('[gk-map] frozen');
      expect(pbSpy.debug).toHaveBeenCalledWith('frozen');
    });
  });
});