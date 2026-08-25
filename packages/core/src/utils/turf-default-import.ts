/**
 * Resolve Turf package default exports under mixed ESM/CJS and Vite/Vitest interop.
 */
export function resolveTurfDefault<T extends (...args: never[]) => unknown>(module: unknown): T {
  if (typeof module === 'function') {
    return module as T;
  }

  if (module && typeof module === 'object') {
    const record = module as Record<string, unknown>;
    if (typeof record.default === 'function') {
      return record.default as T;
    }
    if (typeof record.buffer === 'function') {
      return record.buffer as T;
    }
  }

  throw new Error('Expected a Turf module with a function default export');
}
