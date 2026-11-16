import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@doppler-group/geokit/service/registry';
import { _resetGeokitPlugins } from '@doppler-group/geokit/service/plugin';
import { resetCapabilityRouterReady } from '@doppler-group/geokit/service';

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
