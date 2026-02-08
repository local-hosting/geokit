/**
 * Configurable Debug Logger
 *
 * Factory for creating debug loggers with per-library window flags.
 * Framework-agnostic — usable in any JS/TS project.
 *
 * @example
 * ```typescript
 * // In geokit
 * const { debug, setDebugEnabled, isDebugEnabled } = createLogger({
 *   windowFlag: '__GEOKIT_DEBUG__',
 * });
 *
 * // In geoview (or any consumer)
 * const { debug, setDebugEnabled, isDebugEnabled } = createLogger({
 *   windowFlag: '__GEOVIEW_DEBUG__',
 * });
 * ```
 */

/**
 * Options for creating a debug logger
 */
export interface LoggerOptions {
  /** Name of the `window` property that toggles debug output (default: '__DEBUG__') */
  windowFlag?: string;
}

/**
 * Debug logger instance returned by {@link createLogger}
 */
export interface DebugLogger {
  /** Log a message (only when debug is enabled) */
  log: (message: string, ...args: unknown[]) => void;
  /** Log a warning (only when debug is enabled) */
  warn: (message: string, ...args: unknown[]) => void;
  /** Log an error (always logged, regardless of debug flag) */
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Full return value from {@link createLogger}
 */
export interface Logger {
  /** Debug log/warn/error methods */
  debug: DebugLogger;
  /** Enable or disable debug logging */
  setDebugEnabled: (enabled: boolean) => void;
  /** Check whether debug logging is currently enabled */
  isDebugEnabled: () => boolean;
}

/**
 * Create a debug logger bound to a specific `window` flag.
 *
 * Debug output is **off** by default. Enable it by:
 * - calling `setDebugEnabled(true)`, or
 * - setting `window[windowFlag] = true` in the browser console.
 */
export function createLogger(options?: LoggerOptions): Logger {
  const { windowFlag = '__DEBUG__' } = options || {};

  const isBrowser = typeof window !== 'undefined';

  let enabled =
    isBrowser && (window as unknown as Record<string, boolean | undefined>)[windowFlag] === true;

  function setDebugEnabled(value: boolean): void {
    enabled = value;
    if (isBrowser) {
      (window as unknown as Record<string, boolean>)[windowFlag] = value;
    }
  }

  function isDebugEnabled(): boolean {
    if (isBrowser) {
      const flag = (window as unknown as Record<string, boolean | undefined>)[windowFlag];
      if (flag !== undefined) {
        enabled = flag;
      }
    }
    return enabled;
  }

  const debug: DebugLogger = {
    log(message: string, ...args: unknown[]): void {
      if (isDebugEnabled()) console.log(message, ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      if (isDebugEnabled()) console.warn(message, ...args);
    },
    error(message: string, ...args: unknown[]): void {
      // Errors are always logged
      console.error(message, ...args);
    },
  };

  return { debug, setDebugEnabled, isDebugEnabled };
}
