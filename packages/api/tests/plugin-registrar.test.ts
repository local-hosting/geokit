import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetGeokitPlugins,
  createKeyedPluginRegistrar,
  createOptionalPluginRegistrar,
  type GeokitAPIPlugin,
} from '../src/plugin.js';
import { _resetRegistries, getAPIProvider } from '../src/providers/registry.js';
import { BaseAPIProvider, type APICapability, type MapProviderConfig } from '../src/providers/types.js';

class StubProvider extends BaseAPIProvider {
  getName(): string {
    return 'stub-provider';
  }

  async initialize(_config: MapProviderConfig): Promise<void> {}

  getCapabilities(): APICapability[] {
    return ['placeSearch'];
  }
}

const stubPlugin: GeokitAPIPlugin = {
  name: 'stub-provider',
  capabilities: ['placeSearch'],
  createProvider: () => new StubProvider(),
};

describe('plugin registrars', () => {
  beforeEach(() => {
    _resetRegistries();
    _resetGeokitPlugins();
  });

  it('registers keyed plugins when config resolves', async () => {
    const register = createKeyedPluginRegistrar(stubPlugin, () => ({ apiKey: 'test-key' }));
    await register();
    expect(getAPIProvider('stub-provider')).toBeDefined();
  });

  it('skips keyed plugins when config is missing', async () => {
    const register = createKeyedPluginRegistrar(stubPlugin, () => null);
    await register();
    expect(getAPIProvider('stub-provider')).toBeNull();
  });

  it('registers optional plugins once', async () => {
    const register = createOptionalPluginRegistrar(stubPlugin);
    await register();
    await register();
    expect(getAPIProvider('stub-provider')).toBeDefined();
  });
});
