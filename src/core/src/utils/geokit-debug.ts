import type { DebugLogger } from './logger';
import { createGeokitLogger } from './logger';

const DEFAULT_FLAG = '__GEOKIT_DEBUG__';
const byScope = new Map<string, DebugLogger>();

/** Cached scoped debug surface for geokit packages (`gk-<scope>` via pino-blanc). */
export function geokitDebug(scope: string, windowFlag: string = DEFAULT_FLAG): DebugLogger {
  const normalized = scope.replace(/^gk-/, '').trim();
  const key = `${windowFlag}:${normalized}`;
  const cached = byScope.get(key);
  if (cached) return cached;
  const { debug } = createGeokitLogger(normalized, { windowFlag });
  byScope.set(key, debug);
  return debug;
}