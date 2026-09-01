import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@geokit/service/registry';
import { _resetGeokitPlugins } from '@geokit/service/plugin';
import { resetCapabilityRouterReady } from '@geokit/service';

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
