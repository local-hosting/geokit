/**
 * Geokit Debug Logger
 *
 * Provides conditional logging that can be enabled/disabled.
 * Debug logs are disabled by default in production.
 *
 * To enable debug logging:
 * - Set window.__GEOKIT_DEBUG__ = true in the browser console
 * - Or call setDebugEnabled(true) from your code
 */

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Debug flag - can be set via window.__GEOKIT_DEBUG__ or setDebugEnabled()
let debugEnabled =
  isBrowser && (window as unknown as { __GEOKIT_DEBUG__?: boolean }).__GEOKIT_DEBUG__ === true;

/**
 * Enable or disable debug logging
 */
export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
  if (isBrowser) {
    (window as unknown as { __GEOKIT_DEBUG__?: boolean }).__GEOKIT_DEBUG__ = enabled;
  }
}

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
  // Re-check window flag in case it was set externally
  if (isBrowser) {
    const windowFlag = (window as unknown as { __GEOKIT_DEBUG__?: boolean }).__GEOKIT_DEBUG__;
    if (windowFlag !== undefined) {
      debugEnabled = windowFlag;
    }
  }
  return debugEnabled;
}

/**
 * Debug logger - only logs when debug mode is enabled
 */
export const debug = {
  log: (message: string, ...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.log(message, ...args);
    }
  },
  warn: (message: string, ...args: unknown[]): void => {
    if (isDebugEnabled()) {
      console.warn(message, ...args);
    }
  },
  error: (message: string, ...args: unknown[]): void => {
    // Errors are always logged
    console.error(message, ...args);
  },
};
