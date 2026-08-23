import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockAPIProvider } from '../../core/tests/mocks/mock-api-provider';
import {
  _resetRegistries,
  getCapabilityRouter,
  getRegisteredAPIProviders,
} from '../src/providers/registry';
import {
  _resetGeokitPlugins,
  registerGeokitPlugin,
  unregisterGeokitPlugin,
  type GeokitAPIPlugin,
} from '../src/plugin';
import {
  ensurePlaceSearchRouterReady,
  resetCapabilityRouterReady,
} from '../src/providers/setup-capability-routers';

describe('registerGeokitPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    _resetGeokitPlugins();
    resetCapabilityRouterReady();
  });

  it('registers a plugin provider and appends it to placeSearch chain', async () => {
    const plugin: GeokitAPIPlugin = {
      name: 'mock-places',
      capabilities: ['placeSearch'],
      createProvider: () => {
        const provider = new MockAPIProvider(['placeSearch']);
        provider.getName = () => 'mock-places';
        provider.placeSearchImpl = async () => [
          {
            id: 'mock-1',
            name: 'Mock Place',
            location: [-86.78, 36.16],
          },
        ];
        return provider;
      },
      chain: { placeSearch: 'append' },
    };

    await registerGeokitPlugin(plugin);
    await ensurePlaceSearchRouterReady();

    expect(getRegisteredAPIProviders()).toContain('mock-places');
    const router = getCapabilityRouter('placeSearch');
    expect(router).not.toBeNull();

    const results = await router!.placeSearch!({ ll: [-86.78, 36.16] });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Mock Place');
  });

  it('removes a plugin and rebuilds the chain', async () => {
    const plugin: GeokitAPIPlugin = {
      name: 'mock-places',
      capabilities: ['placeSearch'],
      createProvider: () => new MockAPIProvider(['placeSearch']),
      chain: { placeSearch: 'append' },
    };

    await registerGeokitPlugin(plugin);
    await ensurePlaceSearchRouterReady();
    expect(getRegisteredAPIProviders()).toContain('mock-places');

    unregisterGeokitPlugin('mock-places');
    expect(getRegisteredAPIProviders()).not.toContain('mock-places');
  });
});
