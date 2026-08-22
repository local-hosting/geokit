/**
 * Browser Test Console Suppression
 *
 * Suppresses console output during browser tests to reduce noise.
 * Can be controlled via GEOKIT_BROWSER_LOGS environment variable.
 *
 * Set GEOKIT_BROWSER_LOGS=1 to enable all logs
 * Set GEOKIT_BROWSER_LOGS=warn to show only warnings and errors
 * Set GEOKIT_BROWSER_LOGS=error to show only errors
 * Default: suppress all console output
 */

// Get log level from environment variable
// Vitest makes process.env available in setup files
const logLevel = (typeof process !== 'undefined' && process.env?.GEOKIT_BROWSER_LOGS) || 'none';

// Patterns to always suppress (expected warnings/errors)
const suppressedPatterns = [
  /webglcontextlost/i,
  /WebGL context lost/i,
  /Unexpected loss of WebGL context/i,
  /Map\.setStyle.*Invalid style/i,
  /WebGL.*texImage/i,
  /Partitioned cookie or storage access/i,
  /\[DEPRECATED\].*zustand/i,
  /Default export is deprecated/i,
  /done\(\) callback is deprecated/i,
];

function shouldSuppress(message: string): boolean {
  return suppressedPatterns.some((pattern) => pattern.test(message));
}

function formatMessage(...args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg && typeof arg.toString === 'function') return arg.toString();
      return String(arg);
    })
    .join(' ');
}

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Suppress console.log
if (logLevel === 'none' || logLevel === 'warn' || logLevel === 'error') {
  console.log = () => {
    // Suppressed
  };
}

// Suppress console.info
if (logLevel === 'none' || logLevel === 'warn' || logLevel === 'error') {
  console.info = () => {
    // Suppressed
  };
}

// Suppress console.debug
if (logLevel === 'none' || logLevel === 'warn' || logLevel === 'error') {
  console.debug = () => {
    // Suppressed
  };
}

// Conditionally suppress console.warn
if (logLevel === 'none' || logLevel === 'error') {
  console.warn = (...args: unknown[]) => {
    const message = formatMessage(...args);
    if (!shouldSuppress(message)) {
      // Only show if not in suppressed patterns and log level allows
      // (but we're suppressing, so do nothing)
    }
  };
} else {
  // logLevel is 'warn' or '1' - show warnings but filter suppressed patterns
  console.warn = (...args: unknown[]) => {
    const message = formatMessage(...args);
    if (!shouldSuppress(message)) {
      originalConsole.warn(...args);
    }
  };
}

// Conditionally suppress console.error
if (logLevel === 'none') {
  console.error = (...args: unknown[]) => {
    const message = formatMessage(...args);
    if (!shouldSuppress(message)) {
      // Suppressed
    }
  };
} else {
  // logLevel is 'warn', 'error', or '1' - show errors but filter suppressed patterns
  console.error = (...args: unknown[]) => {
    const message = formatMessage(...args);
    if (!shouldSuppress(message)) {
      originalConsole.error(...args);
    }
  };
}

// Export restore function for tests that need original console
export function restoreConsole(): void {
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
}
