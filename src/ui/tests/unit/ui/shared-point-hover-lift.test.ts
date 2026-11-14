/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureSharedPointHoverLayers } from '../../../src/utils/layers/styles/shared-point-layers';
import { SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS } from '../../../src/utils/shared-point-paint';

describe('floating-badge per-feature hover', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lights the existing badge ring in place (no second hover clone)', () => {
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
    const paint = new Map<string, unknown>();
    const filters = new Map<string, unknown>();
    const layers = new Set([
      'venues-glow',
      'venues-point',
      'venues-point-outer-stroke',
      'venues-point-selection-badge',
      'venues-point-selection-badge-outer',
      'venues-point-hover-badge',
      'venues-point-hover-badge-outer',
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
    sources.set('venues', {
      setData: vi.fn(),
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

    const map = {
      getLayer: (id: string) => (layers.has(id) ? {} : undefined),
      getSource: (id: string) => sources.get(id) ?? sources.get('venues'),
      addSource: vi.fn((id: string) => {
        sources.set(id, { setData: vi.fn(), data: null });
      }),
      addLayer: vi.fn((spec: { id: string }) => {
        layers.add(spec.id);
      }),
      getCanvas: () => ({ style: { setProperty: vi.fn(), cursor: '' } }),
      getContainer: () => document.createElement('div'),
      setPaintProperty: (id: string, prop: string, value: unknown) => {
        paint.set(`${id}:${prop}`, value);
      },
      setFilter: (id: string, filter: unknown) => {
        filters.set(id, filter);
      },
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

    paint.set('venues-point:circle-translate', [0, -24]);

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const t0 = 1_000;
    vi.spyOn(performance, 'now').mockReturnValue(t0);

    ensureSharedPointHoverLayers(map as never, 'venues', 'venues-glow', 'venues-point', {
      glowRadius: [],
      glowColor: '#000',
      glowBlur: 0.45,
      circleColor: '#fff',
      pointRadius: 4,
      promoteId: 'venueId',
      selectionGroundBadge: true,
      floatTranslate: [0, -24],
      hoverTranslate: [0, -24],
      selectedTranslate: [0, -14],
    });

    const move = listeners.get('mousemove:venues-point')?.[0];
    const leave = listeners.get('mouseleave:venues-point')?.[0];

    move?.({
      features: [
        {
          geometry: { type: 'Point', coordinates: [-78.8, 42.8] },
          properties: { venueId: 'buffalo-harbor' },
        },
      ],
    });

    // Enter snaps lit tint onto the existing feature — no hover-source clone.
    expect(filters.has('venues-point')).toBe(false);
    expect(
      (hoverSource.data as { features?: unknown[] } | null)?.features?.length ?? 0
    ).toBe(0);
    const main = sources.get('venues')!;
    expect(main.setData).toHaveBeenCalled();
    const enterData = main.setData.mock.calls.at(-1)?.[0] as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(enterData.features[0]?.properties?._color).toBe('#96dde9');

    const framesBeforeLeave = frames.length;
    leave?.();

    // Leave lerps ring color on the same feature, then restores resting.
    expect(frames.length).toBeGreaterThan(framesBeforeLeave);
    frames[framesBeforeLeave]?.(t0);
    frames[frames.length - 1]?.(t0 + SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS / 2);
    const midColor = (
      main.setData.mock.calls.at(-1)?.[0] as {
        features: Array<{ properties?: Record<string, unknown> }>;
      }
    )?.features?.[0]?.properties?._color;
    expect(midColor).not.toBe('#96dde9');
    expect(midColor).not.toBe('#2dbad2');
    frames[frames.length - 1]?.(t0 + SHARED_POINT_FLOATING_BADGE_HOVER_ANIMATION_MS);

    const restored = (
      main.setData.mock.calls.at(-1)?.[0] as {
        features: Array<{ properties?: Record<string, unknown> }>;
      }
    )?.features?.[0]?.properties?._color;
    expect(restored).toBe('#2dbad2');
    expect(
      (hoverSource.data as { features?: unknown[] } | null)?.features?.length ?? 0
    ).toBe(0);
  });
});
