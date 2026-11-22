import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import { geokitDebug } from '../../../src/utils/geokit-debug';

const FLAG = '__GEOKIT_DEBUG_TEST__';

describe('geokitDebug', () => {
  beforeEach(() => {
    pbSpy.debug.mockClear();
    (globalThis as Record<string, boolean | undefined>)[FLAG] = true;
  });

  it('returns the same debug surface for repeated scope lookups', () => {
    const a = geokitDebug('map', FLAG);
    const b = geokitDebug('map', FLAG);
    expect(a).toBe(b);
  });

  it('strips gk- prefix from scope when binding module', () => {
    const debug = geokitDebug('gk-h3', FLAG);
    debug.log('cells', 2);
    expect(pbSpy.debug).toHaveBeenCalledWith('cells', { detail: 2 });
  });
});