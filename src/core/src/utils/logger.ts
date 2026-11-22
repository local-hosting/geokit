/**
 * Configurable debug logger
 *
 * Emits through {@link @westlane/pino-blanc} in browser and Node test hosts.
 * Geokit scopes use `gk-<scope>` child module names; pino-blanc renders `[gk-<scope>]` via `%md%`.
 */

import { createBrowserLogger } from '@westlane/pino-blanc/browser';
import type { PBLogger } from '@westlane/pino-blanc';
import { GEOKIT_LOG_THEME } from './geokit-log-theme';

export interface LoggerOptions {
  windowFlag?: string;
  /** Geokit scope — binds pino-blanc `module` (`gk-<scope>`); do not put tags in `msg`. */
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

/** Leading legacy tags in message text (stripped before emit; also selects pino `module`). */
const GEOKIT_TAG_PREFIX = /^\[(?:gk-[^\]]+|layer-styles)\]\s*/;

const DEFAULT_MODULE = 'gk-core';

const rootPb = createBrowserLogger('geokit', { theme: GEOKIT_LOG_THEME });
const pbByModule = new Map<string, PBLogger>();

function moduleNameForScope(scope: string | undefined): string {
  if (!scope) return DEFAULT_MODULE;
  return scope.startsWith('gk-') ? scope : `gk-${scope}`;
}

function legacyTagToModule(tag: string): string {
  return tag === 'layer-styles' ? 'gk-layer-styles' : tag;
}

/** If the message starts with `[gk-…]` / `[layer-styles]`, use that module and strip the tag. */
function parseLegacyTag(message: string): { module: string; text: string } | null {
  const match = message.match(/^\[(gk-[^\]]+|layer-styles)\]\s*/);
  if (!match) return null;
  return { module: legacyTagToModule(match[1]), text: message.slice(match[0].length) };
}

function resolveEmitTarget(
  scope: string | undefined,
  defaultPb: PBLogger,
  message: string,
): { pb: PBLogger; text: string } {
  const legacy = parseLegacyTag(message);
  if (legacy) {
    return { pb: pbForModule(legacy.module), text: legacy.text };
  }
  return { pb: defaultPb, text: formatGeokitMessage(scope, message) };
}

function pbForModule(module: string): PBLogger {
  const cached = pbByModule.get(module);
  if (cached) return cached;
  const child = rootPb.child({ module });
  pbByModule.set(module, child);
  return child;
}

/** @example geokitTag('h3') // '[gk-h3]' */
export function geokitTag(scope: string): string {
  const normalized = scope.startsWith('gk-') ? scope : `gk-${scope}`;
  return `[${normalized}]`;
}

/** Strip a legacy `[gk-*]` prefix from `msg`; scope tag comes from pino-blanc `module`. */
export function formatGeokitMessage(scope: string | undefined, message: string): string {
  void scope;
  return message.replace(GEOKIT_TAG_PREFIX, '');
}

function isMetaObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emitPb(
  pb: PBLogger,
  level: 'debug' | 'warn' | 'error',
  message: string,
  args: unknown[],
): void {
  if (args.length === 0) {
    pb[level](message);
    return;
  }
  if (args.length === 1 && isMetaObject(args[0])) {
    pb[level](message, args[0]);
    return;
  }
  pb[level](message, { detail: args.length === 1 ? args[0] : args });
}

/** Create a geokit-scoped logger using the standard `__GEOKIT_DEBUG__` flag. */
export function createGeokitLogger(
  scope: string,
  options?: Omit<LoggerOptions, 'scope'>,
): Logger {
  return createLogger({
    windowFlag: '__GEOKIT_DEBUG__',
    ...options,
    scope,
  });
}

/**
 * Operational log surface — always emits through pino-blanc (not gated by `__GEOKIT_DEBUG__`).
 */
export function geokitNotify(scope: string): Pick<DebugLogger, 'log' | 'warn' | 'error'> {
  const defaultPb = pbForModule(moduleNameForScope(scope));
  return {
    log(message: string, ...args: unknown[]) {
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'debug', text, args);
    },
    warn(message: string, ...args: unknown[]) {
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'warn', text, args);
    },
    error(message: string, ...args: unknown[]) {
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'error', text, args);
    },
  };
}

export function createLogger(options?: LoggerOptions): Logger {
  const { windowFlag = '__DEBUG__', scope } = options || {};
  const defaultPb = pbForModule(moduleNameForScope(scope));

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
      if (!isDebugEnabled()) return;
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'debug', text, args);
    },
    warn(message: string, ...args: unknown[]): void {
      if (!isDebugEnabled()) return;
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'warn', text, args);
    },
    error(message: string, ...args: unknown[]): void {
      const { pb, text } = resolveEmitTarget(scope, defaultPb, message);
      emitPb(pb, 'error', text, args);
    },
  };

  return { debug, setDebugEnabled, isDebugEnabled };
}