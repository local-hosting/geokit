import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@geokit/api/registry';
import { _resetGeokitPlugins } from '@geokit/api/plugin';
import { resetCapabilityRouterReady } from '@geokit/api/setup-capability-routers';

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
