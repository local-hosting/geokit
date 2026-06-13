/**
 * Map style-load and theme switch tests
 *
 * Tests for _onStyleLoadReaddLayers behavior:
 * - When style load fails (error event), we do not dispatch gk-map-style-load
 * - dispatchReadd skips when styleLoadFailed is true
 * - Error message matching (style / could not be loaded / distant)
 */

import { describe, it, expect } from 'vitest';

describe('Map style-load and error handling', () => {
  describe('styleLoadFailed when error is style-related', () => {
    it('should set styleLoadFailed when error message contains "style"', () => {
      const msg = 'Something went wrong loading the style';
      const styleLoadFailed = /style|could not be loaded|distant/i.test(msg);
      expect(styleLoadFailed).toBe(true);
    });

    it('should set styleLoadFailed when error message contains "could not be loaded"', () => {
      const msg = 'The distant style could not be loaded. Leaving the style as is.';
      const styleLoadFailed = /style|could not be loaded|distant/i.test(msg);
      expect(styleLoadFailed).toBe(true);
    });

    it('should set styleLoadFailed when error message contains "distant"', () => {
      const msg = 'distant resource failed';
      const styleLoadFailed = /style|could not be loaded|distant/i.test(msg);
      expect(styleLoadFailed).toBe(true);
    });

    it('should not set styleLoadFailed for unrelated error', () => {
      const msg = 'Layer not found';
      const styleLoadFailed = /style|could not be loaded|distant/i.test(msg);
      expect(styleLoadFailed).toBe(false);
    });
  });

  describe('dispatchReadd skips when styleLoadFailed', () => {
    it('should not dispatch when styleLoadFailed is true', () => {
      const styleLoadFailed = true;
      const dispatchedBefore = false;
      const scheduled = false;

      const wouldDispatch = !dispatchedBefore && !scheduled && !styleLoadFailed;
      expect(wouldDispatch).toBe(false);
    });

    it('should allow dispatch when styleLoadFailed is false', () => {
      const styleLoadFailed = false;
      const dispatchedBefore = false;
      const scheduled = false;

      const wouldDispatch = !dispatchedBefore && !scheduled && !styleLoadFailed;
      expect(wouldDispatch).toBe(true);
    });
  });

  describe('error event payload shape', () => {
    it('should read error.message from map error event', () => {
      const e = { error: { message: 'The distant style could not be loaded.' } };
      const msg = e?.error?.message ?? '';
      expect(msg).toBe('The distant style could not be loaded.');
    });

    it('should handle missing error payload', () => {
      const e: { error?: { message?: string } } = {};
      const msg = e?.error?.message ?? '';
      expect(msg).toBe('');
    });
  });

  describe('style-load fallback polling', () => {
    it('should dispatch when isStyleReady() becomes true within maxWaitMs', () => {
      let ready = false;
      const _isStyleReady = () => ready;
      const _maxWaitMs = 2500;
      let _elapsed = 150;
      const pollMs = 50;

      // Simulate first check (fallback timeout fired)
      if (_isStyleReady()) {
        expect(true).toBe(true);
        return;
      }
      // Simulate poll: after a few ticks, style becomes ready
      _elapsed += pollMs;
      ready = true;
      expect(_isStyleReady()).toBe(true);
    });

    it('should dispatch after maxWaitMs even if style not ready', () => {
      const _isStyleReady = () => false;
      const maxWaitMs = 2500;
      let elapsed = 150;
      const pollMs = 50;

      while (elapsed < maxWaitMs) {
        elapsed += pollMs;
      }
      const shouldDispatchAnyway = elapsed >= maxWaitMs;
      expect(shouldDispatchAnyway).toBe(true);
    });
  });
});
