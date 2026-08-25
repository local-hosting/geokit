import { beforeEach, vi } from 'vitest';
import { resetGeokitServiceRegistries, resetAPIRegistries } from '../../src/testing/reset-registries.ts';

/** Reset API provider registry only (API package tests). */
export function useCleanAPIRegistry(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGeokitServiceRegistries();
  });
}

export { resetAPIRegistries, resetGeokitServiceRegistries };
