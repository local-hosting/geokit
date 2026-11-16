import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@local-hosting/geokit/service/registry';
import { _resetGeokitPlugins } from '@local-hosting/geokit/service/plugin';
import { resetCapabilityRouterReady } from '@local-hosting/geokit/service';

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
