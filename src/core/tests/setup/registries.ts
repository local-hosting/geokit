import { beforeEach, vi } from 'vitest';
import { _resetRegistries as resetAPIRegistries } from '@doppler-group/geokit/service/registry';
import { _resetRegistries as resetUIRegistries } from '../../src/ui/providers/registry';

/** Reset API and UI provider registries before each test. */
export function useCleanProviderRegistries(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAPIRegistries();
    resetUIRegistries();
  });
}

/** Reset API provider registry only (most API provider tests). */
export function useCleanAPIRegistry(): void {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAPIRegistries();
  });
}

export { resetAPIRegistries, resetUIRegistries };
