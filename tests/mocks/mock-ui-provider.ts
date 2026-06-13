import { vi } from 'vitest';
import type { BaseUIProvider, MapProviderConfig } from '../../src/ui/providers/types';

/** Minimal UI provider stub for registry and component integration tests. */
export class MockUIProvider implements BaseUIProvider {
  getName(): string {
    return 'mock-ui';
  }

  async initialize(_config: MapProviderConfig): Promise<void> {}

  async createMap(_container: HTMLElement, _options: Record<string, unknown>): Promise<unknown> {
    return {
      on: vi.fn(),
      off: vi.fn(),
      remove: vi.fn(),
      addSource: vi.fn(),
      addLayer: vi.fn(),
      removeLayer: vi.fn(),
      removeSource: vi.fn(),
      getLayer: vi.fn(),
      getSource: vi.fn(() => ({ _data: { type: 'FeatureCollection', features: [] } })),
      getCanvas: vi.fn(() => ({ style: { cursor: '' } })),
    };
  }

  createControl(_type: string, _options: Record<string, unknown>): unknown {
    return { onAdd: vi.fn(), onRemove: vi.fn() };
  }

  createMarker(_options: Record<string, unknown>): unknown {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    };
  }

  createPopup(_options: Record<string, unknown>): unknown {
    return {
      setLngLat: vi.fn().mockReturnThis(),
      setHTML: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    };
  }

  getSDK(): Record<string, never> {
    return {};
  }
}
