import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  configure,
  getProviderByName,
  registerUIProvider,
  setUIProvider,
  getUIProvider,
  _resetRegistries,
} from '../../../src/providers/registry';
import type { BaseUIProvider, UIProviderConfig } from '../../../src/providers/types';

// Mock provider for testing
class MockUIProvider implements BaseUIProvider {
  private config: UIProviderConfig | null = null;
  private initialized = false;

  getName(): string {
    return 'mock';
  }

  async initialize(config: UIProviderConfig): Promise<void> {
    this.config = { ...(this.config ?? {}), ...config };
    this.initialized = true;
  }

  async createMap(_container: HTMLElement, _options: any): Promise<any> {
    if (!this.initialized) throw new Error('Provider not initialized');
    return {
      on: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getLayer: vi.fn(),
      getSource: vi.fn(),
      addControl: vi.fn(),
      removeControl: vi.fn(),
      getCanvas: vi.fn(() => ({
        style: { cursor: '' },
      })),
    };
  }

  createControl(_type: string, _options: any): any {
    return { onAdd: vi.fn(), onRemove: vi.fn() };
  }

  createMarker(_options: any): any {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
      getLngLat: vi.fn(() => ({ lng: 0, lat: 0 })),
    };
  }

  createPopup(_options: any): any {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    };
  }

  getSDK(): any {
    return {};
  }
}

describe('UI Providers', () => {
  beforeEach(() => {
    // Reset any registered providers
    vi.clearAllMocks();
    _resetRegistries();
  });

  describe('registerUIProvider', () => {
    it('should register a new UI provider', () => {
      const provider = new MockUIProvider();
      expect(() => registerUIProvider('test-provider', provider)).not.toThrow();
    });

    it('should allow registering multiple providers', () => {
      const provider1 = new MockUIProvider();
      const provider2 = new MockUIProvider();

      expect(() => registerUIProvider('provider1', provider1)).not.toThrow();
      expect(() => registerUIProvider('provider2', provider2)).not.toThrow();
    });
  });

  describe('configure + getProviderByName', () => {
    it('preserves transformRequest when re-init passes apiKey only', async () => {
      const transformRequest = vi.fn((url: string) => ({ url: `/proxy/${url}` }));
      const provider = new MockUIProvider();
      const initSpy = vi.spyOn(provider, 'initialize');
      registerUIProvider('merge-test', provider);

      configure({ 'merge-test': { apiKey: 'global-key', transformRequest } });
      await setUIProvider('merge-test', { apiKey: 'global-key', transformRequest });

      await getProviderByName('merge-test', { apiKey: 'map-element-key' });

      expect(initSpy).toHaveBeenLastCalledWith({
        apiKey: 'map-element-key',
        transformRequest,
      });
    });
  });

  describe('setUIProvider', () => {
    it('should set and initialize a registered provider', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);

      const result = await setUIProvider('test', { apiKey: 'test-key' });
      expect(result).toBe(provider);
    });

    it('should throw if provider is not registered', async () => {
      await expect(setUIProvider('non-existent')).rejects.toThrow();
    });

    it('should initialize provider with config', async () => {
      const provider = new MockUIProvider();
      const initSpy = vi.spyOn(provider, 'initialize');
      registerUIProvider('test', provider);

      await setUIProvider('test', { apiKey: 'test-key' });
      expect(initSpy).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('should replace current provider when setting new one', async () => {
      const provider1 = new MockUIProvider();
      const provider2 = new MockUIProvider();

      registerUIProvider('provider1', provider1);
      registerUIProvider('provider2', provider2);

      await setUIProvider('provider1');
      const current1 = getUIProvider();
      expect(current1.getName()).toBe('mock');

      await setUIProvider('provider2');
      const current2 = getUIProvider();
      expect(current2.getName()).toBe('mock');
    });
  });

  describe('getUIProvider', () => {
    it('should return the current active provider', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);
      await setUIProvider('test');

      const current = getUIProvider();
      expect(current).toBe(provider);
    });

    it('should throw if no provider is set', () => {
      // After reset, no provider should be set
      expect(() => {
        const _provider = getUIProvider();
      }).toThrow();
    });
  });

  describe('provider lifecycle', () => {
    it('should create map after initialization', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);
      await setUIProvider('test', { apiKey: 'test-key' });

      const container = document.createElement('div');
      const map = await provider.createMap(container, { zoom: 10 });

      expect(map).toBeDefined();
      expect(map.on).toBeDefined();
    });

    it('should create controls', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);
      await setUIProvider('test');

      const control = provider.createControl('navigation', {});
      expect(control).toBeDefined();
      expect(control.onAdd).toBeDefined();
    });

    it('should create markers', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);
      await setUIProvider('test');

      const marker = provider.createMarker({ color: '#ff0000' });
      expect(marker).toBeDefined();
      expect(marker.setLngLat).toBeDefined();
    });

    it('should create popups', async () => {
      const provider = new MockUIProvider();
      registerUIProvider('test', provider);
      await setUIProvider('test');

      const popup = provider.createPopup({ anchor: 'bottom' });
      expect(popup).toBeDefined();
      expect(popup.setLngLat).toBeDefined();
    });
  });
});
