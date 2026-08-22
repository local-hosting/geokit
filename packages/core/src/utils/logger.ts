/**
 * Configurable Debug Logger
 *
 * Factory for creating debug loggers with per-library window flags.
 * Framework-agnostic — usable in any JS/TS project.
 *
 * Geokit scopes use `[gk-<scope>]` prefixes (see {@link geokitTag}).
 */

export interface LoggerOptions {
  windowFlag?: string;
  /** Geokit scope — prefixes messages with `[gk-<scope>]` when set */
  scope?: string;
}

export interface DebugLogger {
  log: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

export interface Logger {
  debug: DebugLogger;
  setDebugEnabled: (enabled: boolean) => void;
  isDebugEnabled: () => boolean;
}

const GEOKIT_TAG_PATTERN = /^\[gk-[^\]]+\]/;

/** @example geokitTag('h3') // '[gk-h3]' */
export function geokitTag(scope: string): string {
  const normalized = scope.startsWith('gk-') ? scope : `gk-${scope}`;
  return `[${normalized}]`;
}

/** Prefix a message with a geokit scope tag when not already tagged. */
export function formatGeokitMessage(scope: string | undefined, message: string): string {
  if (!scope) return message;
  const tag = geokitTag(scope);
  if (message.startsWith(tag) || GEOKIT_TAG_PATTERN.test(message)) {
    return message;
  }
  return `${tag} ${message}`;
}

/** Create a geokit-scoped logger using the standard `__GEOKIT_DEBUG__` flag. */
export function createGeokitLogger(
  scope: string,
  options?: Omit<LoggerOptions, 'scope'>
): Logger {
  return createLogger({
    windowFlag: '__GEOKIT_DEBUG__',
    ...options,
    scope,
  });
}

export function createLogger(options?: LoggerOptions): Logger {
  const { windowFlag = '__DEBUG__', scope } = options || {};

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

  function format(message: string): string {
    return formatGeokitMessage(scope, message);
  }

  const debug: DebugLogger = {
    log(message: string, ...args: unknown[]): void {
      if (isDebugEnabled()) console.log(format(message), ...args);
    },
    warn(message: string, ...args: unknown[]): void {
      if (isDebugEnabled()) console.warn(format(message), ...args);
    },
    error(message: string, ...args: unknown[]): void {
      console.error(format(message), ...args);
    },
  };

  return { debug, setDebugEnabled, isDebugEnabled };
}
