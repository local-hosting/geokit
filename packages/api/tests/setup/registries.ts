import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '../../src/providers/registry.ts';
import { _resetGeokitPlugins } from '../../src/plugin.ts';
import { resetCapabilityRouterReady } from '../../src/providers/capability-router-rebuild.ts';

/** Reset API provider registry only (API package tests). */
export function useCleanAPIRegistry(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAPIRegistries();
    _resetGeokitPlugins();
    resetCapabilityRouterReady();
  });
}

export { resetAPIRegistries };
