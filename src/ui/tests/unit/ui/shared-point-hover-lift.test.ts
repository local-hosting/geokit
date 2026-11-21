/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSharedPointHoverLayers } from '../../../src/utils/layers/styles/shared-point-layers';

describe('floating-badge per-feature hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('keeps hover chrome off (no glow layer, no ring lighten)', () => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const layout = new Map<string, unknown>();
    const layers = new Set([
      'venues-glow',
      'venues-point',
      'venues-point-outer-stroke',
      'venues-point-selection-badge',
      'venues-point-selection-badge-outer',
    ]);
    const sources = new Map<
      string,
      { setData: ReturnType<typeof vi.fn>; data: unknown; _data?: unknown }
    >();
    const hoverSource = {
      setData: vi.fn((data: unknown) => {
        hoverSource.data = data;
      }),
      data: null as unknown,
    };
    sources.set('venues-hover', hoverSource);
    const mainSetData = vi.fn();
    sources.set('venues', {
      setData: mainSetData,
      data: null,
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { venueId: 'buffalo-harbor', _color: '#2dbad2' },
            geometry: { type: 'Point', coordinates: [-78.8, 42.8] },
          },
        ],
      },
    });

    const addedLayers: Array<{ id: string; layout?: Record<string, unknown> }> = [];
    const map = {
      getLayer: (id: string) => (layers.has(id) ? {} : undefined),
      getSource: (id: string) => sources.get(id) ?? sources.get('venues'),
      addSource: vi.fn((id: string) => {
        sources.set(id, { setData: vi.fn(), data: null });
      }),
      addLayer: vi.fn((spec: { id: string; layout?: Record<string, unknown> }) => {
        layers.add(spec.id);
        addedLayers.push({ id: spec.id, layout: spec.layout });
      }),
      getCanvas: () => ({ style: { setProperty: vi.fn(), cursor: '' } }),
      getContainer: () => document.createElement('div'),
      setPaintProperty: vi.fn(),
      setLayoutProperty: (id: string, prop: string, value: unknown) => {
        layout.set(`${id}:${prop}`, value);
      },
      setFilter: vi.fn(),
      setFeatureState: vi.fn(),
      removeFeatureState: vi.fn(),
      on: (
        type: string,
        layerOrHandler: string | ((...args: unknown[]) => void),
        maybeHandler?: (...args: unknown[]) => void
      ) => {
        const layerId = typeof layerOrHandler === 'string' ? layerOrHandler : '';
        const handler = typeof layerOrHandler === 'function' ? layerOrHandler : maybeHandler;
        if (!handler) return;
        const key = layerId ? `${type}:${layerId}` : type;
        const list = listeners.get(key) ?? [];
        list.push(handler);
        listeners.set(key, list);
      },
      off: vi.fn(),
    };

    ensureSharedPointHoverLayers(map as never, 'venues', 'venues-glow', 'venues-point', {
      glowRadius: [],
      glowColor: '#000',
      glowBlur: 0.45,
      circleColor: '#fff',
      pointRadius: 4,
      promoteId: 'venueId',
      selectionGroundBadge: true,
      floatTranslate: [0, 0],
      hoverTranslate: [0, 0],
      selectedTranslate: [0, -24],
      selectionGroundBadgeFallbackColor: '#2dbad2',
    });

    const glowHover = addedLayers.find((layer) => layer.id === 'venues-glow-hover');
    if (glowHover) {
      expect(glowHover.layout?.visibility).toBe('none');
    }
    expect(layout.get('venues-glow-hover:visibility')).not.toBe('visible');

    const move = listeners.get('mousemove:venues-point')?.[0];
    move?.({
      features: [
        {
          geometry: { type: 'Point', coordinates: [-78.8, 42.8] },
          properties: { venueId: 'buffalo-harbor', _color: '#2dbad2' },
        },
      ],
    });

    expect(mainSetData).toHaveBeenCalledTimes(1);
    expect(
      (hoverSource.data as { features?: unknown[] } | null)?.features?.length ?? 0
    ).toBe(0);
  });
});
