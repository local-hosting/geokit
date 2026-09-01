import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetGeokitPlugins,
  createKeyedPluginRegistrar,
  createOptionalPluginRegistrar,
  type GeokitServicePlugin,
} from '../src/plugin';
import { _resetRegistries, getService } from '../src/services/registry';
import { Service, type ServiceCapability, type ServiceConfig } from '../src/services/types';

class StubProvider extends Service {
  getName(): string {
    return 'stub-provider';
  }

  async initialize(_config: ServiceConfig): Promise<void> {}

  getCapabilities(): ServiceCapability[] {
    return ['placeSearch'];
  }
}

const stubPlugin: GeokitServicePlugin = {
  name: 'stub-provider',
  capabilities: ['placeSearch'],
  createService: () => new StubProvider(),
};

describe('plugin registrars', () => {
  beforeEach(() => {
    _resetRegistries();
    _resetGeokitPlugins();
  });

  it('registers keyed plugins when config resolves', async () => {
    const register = createKeyedPluginRegistrar(stubPlugin, () => ({ apiKey: 'test-key' }));
    await register();
    expect(getService('stub-provider')).toBeDefined();
  });

  it('skips keyed plugins when config is missing', async () => {
    const register = createKeyedPluginRegistrar(stubPlugin, () => null);
    await register();
    expect(getService('stub-provider')).toBeNull();
  });

  it('registers optional plugins once', async () => {
    const register = createOptionalPluginRegistrar(stubPlugin);
    await register();
    await register();
    expect(getService('stub-provider')).toBeDefined();
  });
});
