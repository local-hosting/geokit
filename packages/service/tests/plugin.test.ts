import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MockAPIProvider } from '../../core/tests/mocks/mock-api-provider';
import {
  _resetRegistries,
  getCapabilityRouter,
  getRegisteredServices,
} from '../src/services/registry';
import {
  _resetGeokitPlugins,
  registerGeokitPlugin,
  unregisterGeokitPlugin,
  type GeokitServicePlugin,
} from '../src/plugin';
import {
  rebuildCapabilityRouters,
  resetCapabilityRouterReady,
} from '../src/services/capability-router-rebuild';

describe('registerGeokitPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRegistries();
    _resetGeokitPlugins();
    resetCapabilityRouterReady();
  });

  it('registers a plugin provider and appends it to placeSearch chain', async () => {
    const plugin: GeokitServicePlugin = {
      name: 'mock-places',
      capabilities: ['placeSearch'],
      createService: () => {
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
    await rebuildCapabilityRouters();

    expect(getRegisteredServices()).toContain('mock-places');
    const router = getCapabilityRouter('placeSearch');
    expect(router).not.toBeNull();

    const results = await router!.placeSearch!({ ll: [-86.78, 36.16] });
    expect(results).toHaveLength(1);
    expect(results[0]?.name).toBe('Mock Place');
  });

  it('removes a plugin and rebuilds the chain', async () => {
    const plugin: GeokitServicePlugin = {
      name: 'mock-places',
      capabilities: ['placeSearch'],
      createService: () => new MockAPIProvider(['placeSearch']),
      chain: { placeSearch: 'append' },
    };

    await registerGeokitPlugin(plugin);
    await rebuildCapabilityRouters();
    expect(getRegisteredServices()).toContain('mock-places');

    unregisterGeokitPlugin('mock-places');
    expect(getRegisteredServices()).not.toContain('mock-places');
  });
});
