import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '../../src/providers/registry.ts';

/** Reset API provider registry only (API package tests). */
export function useCleanAPIRegistry(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAPIRegistries();
  });
}

export { resetAPIRegistries };
