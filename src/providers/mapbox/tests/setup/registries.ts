import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@twinfile/geokit/service/registry';
import { _resetGeokitPlugins } from '@twinfile/geokit/service/plugin';
import { resetCapabilityRouterReady } from '@twinfile/geokit/service';

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
