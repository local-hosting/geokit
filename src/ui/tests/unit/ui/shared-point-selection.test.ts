import { describe, expect, it, vi } from 'vitest';
import {
  animateSharedPointSelectionBadgeTranslate,
  clearSharedPointSelection,
  getSharedPointSelection,
  lookupSharedPointCoords,
  setSharedPointSelection,
  setupSelectionGroundBadgeLayers,
} from '../../../src/utils/layers/styles/shared-point-layers';
import {
  SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE,
  SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE,
} from '../../../src/utils/shared-point-paint';
function createMockMap() {
  const sources = new Map<string, { data: unknown; _data?: unknown }>();
  const featureState = new Map<string, Record<string, unknown>>();
  return {
    getSource: (id: string) => {
      const entry = sources.get(id);
      if (!entry) return undefined;
      return {
        _data: entry._data,
        data: entry._data ?? entry.data,
        setData: (data: unknown) => {
          entry.data = data;
        },
      };
    },
    addSource: vi.fn(),
    getLayer: vi.fn(),
    addLayer: vi.fn(),
    setFeatureState: vi.fn((ref: { source: string; id: string }, state: Record<string, unknown>) => {
      featureState.set(`${ref.source}:${ref.id}`, {
        ...(featureState.get(`${ref.source}:${ref.id}`) ?? {}),
        ...state,
      });
    }),
    removeFeatureState: vi.fn((ref: { source: string; id: string }, key?: string) => {
      const mapKey = `${ref.source}:${ref.id}`;
      if (!key) {
        featureState.delete(mapKey);
        return;
      }
      const cur = featureState.get(mapKey);
      if (!cur) return;
      delete cur[key];
      featureState.set(mapKey, cur);
    }),
    _sources: sources,
    _featureState: featureState,
  };
}

describe('shared point selection', () => {
  it('tracks selection and moves the dedicated ring source', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: -85.7, lat: 38.2 },
    });

    const state = getSharedPointSelection(map as never, sourceId);
    expect(state?.featureId).toBe('point-a');
    expect(state?.lngLat).toEqual({ lng: -85.7, lat: 38.2 });

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ geometry: { coordinates: number[] } }>;
    };
    expect(ringData.features[0].geometry.coordinates).toEqual([-85.7, 38.2]);
  });

  it('writes feature id and promoteId onto the selection source so badge hits resolve', () => {
    const map = createMockMap();
    const sourceId = 'canvas-venues';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'buffalo-harbor',
        lngLat: { lng: -78.87, lat: 42.88 },
      },
      { promoteId: 'venueId' }
    );

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{
        id?: string | number;
        properties?: Record<string, unknown>;
      }>;
    };
    const feature = ringData.features[0];
    expect(feature.id).toBe('buffalo-harbor');
    expect(feature.properties?.venueId).toBe('buffalo-harbor');
  });

  it('clears selection state and ring source', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: 1, lat: 2 },
    });
    clearSharedPointSelection(map as never, sourceId);

    expect(getSharedPointSelection(map as never, sourceId)?.featureId).toBeNull();
    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: unknown[];
    };
    expect(ringData.features).toHaveLength(0);
  });

  it('sets and clears feature-state selected for grounded badge landing', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    map._sources.set(sourceId, { data: null });
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-1',
      lngLat: { lng: -85.7, lat: 38.2 },
    });
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: sourceId, id: 'venue-1' },
      { selected: true }
    );

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'venue-2',
      lngLat: { lng: -85.8, lat: 38.3 },
    });
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: sourceId, id: 'venue-1' },
      { selected: false }
    );
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: sourceId, id: 'venue-2' },
      { selected: true }
    );

    clearSharedPointSelection(map as never, sourceId);
    expect(map.setFeatureState).toHaveBeenCalledWith(
      { source: sourceId, id: 'venue-2' },
      { selected: false }
    );
  });
  it('copies selected feature properties onto the ring source', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: -85.7, lat: 38.2 },
      properties: { type: 'partner', averageRating: 4.2 },
    });

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ properties: Record<string, unknown> }>;
    };
    expect(ringData.features[0].properties).toMatchObject({
      type: 'partner',
      averageRating: 4.2,
      venueId: 'point-a',
    });
    expect(ringData.features[0]).toMatchObject({ id: 'point-a' });
  });
  it('prefers source geometry over click lngLat when selecting', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    const venueSource = {
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { slug: 'point-a' },
            geometry: { type: 'Point', coordinates: [-104.99, 39.7392] },
          },
        ],
      },
    };
    map._sources.set(sourceId, venueSource);
    map._sources.set(`${sourceId}-selection`, { data: null });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: -105.5, lat: 39.2 },
    });

    expect(lookupSharedPointCoords(map as never, sourceId, 'point-a')).toEqual({
      lng: -104.99,
      lat: 39.7392,
    });
    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ geometry: { coordinates: number[] } }>;
    };
    expect(ringData.features[0].geometry.coordinates).toEqual([-104.99, 39.7392]);
  });
  it('clears dedicated hover overlay source on select', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    map._sources.set(`${sourceId}-selection`, { data: null });
    map._sources.set(`${sourceId}-hover`, {
      data: {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [1, 2] }, properties: {} },
        ],
      },
    });

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: -85.7, lat: 38.2 },
    });

    const hoverData = map._sources.get(`${sourceId}-hover`)?.data as { features: unknown[] };
    expect(hoverData.features).toHaveLength(0);
  });

  it('lazy-mounts selection ring source when missing on select', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    const pointLayerId = 'hero-venue-points';
    map.getLayer = vi.fn((id: string) => (id === pointLayerId ? {} : undefined));
    map.getPaintProperty = vi.fn(() => ['interpolate', ['linear'], ['zoom'], 10, 4]);
    map.addSource = vi.fn((id: string) => {
      map._sources.set(id, { data: null });
    });
    map.addLayer = vi.fn();

    setSharedPointSelection(map as never, sourceId, {
      featureId: 'point-a',
      lngLat: { lng: -85.7, lat: 38.2 },
    }, { pointLayerId });

    expect(map.addSource).toHaveBeenCalledWith(
      `${sourceId}-selection`,
      expect.objectContaining({ type: 'geojson' })
    );
    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: `${pointLayerId}-selection-ring` })
    );
  });

  it('does not restore selection halo stroke when selectionGroundBadge is active', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    const pointLayerId = 'canvas-venues-point';
    const ringLayerId = `${pointLayerId}-selection-ring`;
    map._sources.set(`${sourceId}-selection`, { data: null });
    map.getLayer = vi.fn((id: string) =>
      id === pointLayerId || id === ringLayerId ? {} : undefined
    );
    map.getPaintProperty = vi.fn(() => ['literal', 8]);
    map.setPaintProperty = vi.fn();
    map.moveLayer = vi.fn();

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'venue-1',
        lngLat: { lng: -79.33, lat: 42.48 },
      },
      {
        pointLayerId,
        selectionGroundBadge: true,
        selectionPointStrokeWidth: 0,
        selectionRingColor: '#ffffff',
      }
    );

    const strokeCalls = (map.setPaintProperty as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === ringLayerId && call[1] === 'circle-stroke-width'
    );
    expect(strokeCalls.length).toBeGreaterThan(0);
    expect(strokeCalls.every((call) => call[2] === 0)).toBe(true);
    expect(map.setPaintProperty).toHaveBeenCalledWith(ringLayerId, 'circle-stroke-opacity', 0);
    expect(map.moveLayer).not.toHaveBeenCalled();
  });

  it('keeps incoming _badgeIcon when source feature has no badge glyph property', () => {
    const map = createMockMap();
    const sourceId = 'canvas-places';
    map._sources.set(`${sourceId}-selection`, { data: null });
    map._sources.set(sourceId, {
      data: null,
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { placeId: 'dock-a', _color: '#335577' },
            geometry: { type: 'Point', coordinates: [-79.33, 42.48] },
          },
        ],
      },
    });

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'dock-a',
        lngLat: { lng: -79.33, lat: 42.48 },
        properties: {
          placeId: 'dock-a',
          _badgeIcon: 'canvas-badge-cube',
          _color: '#ee5533',
        },
      },
      { promoteId: 'placeId', pointLayerId: 'canvas-places-point', selectionGroundBadge: true }
    );

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(ringData.features[0]?.properties?._badgeIcon).toBe('canvas-badge-cube');
    expect(ringData.features[0]?.properties?._color).toBe('#ee5533');
  });

  it('merges source _color into selection props when click props omit it', () => {
    const map = createMockMap();
    const sourceId = 'canvas-venues';
    map._sources.set(`${sourceId}-selection`, { data: null });
    map._sources.set(sourceId, {
      data: null,
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { venueId: 'dunkirk-dock', _color: '#9acd32' },
            geometry: { type: 'Point', coordinates: [-79.33, 42.48] },
          },
        ],
      },
    });

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'dunkirk-dock',
        lngLat: { lng: -79.33, lat: 42.48 },
        // queryRenderedFeatures often drops paint props
        properties: { venueId: 'dunkirk-dock', name: 'Dunkirk Dock' },
      },
      { promoteId: 'venueId' }
    );

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(ringData.features[0]?.properties?._color).toBe('#9acd32');
  });

  it('selected badge keeps key-color core + white ring (not hover-washed _color)', () => {
    const map = createMockMap();
    const sourceId = 'canvas-venues';
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    map._sources.set(`${sourceId}-selection`, { data: null });
    map._sources.set(sourceId, {
      data: null,
      _data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              venueId: 'buffalo-harbor',
              // Hover in-place lighten overwrote `_color` with the lit tint.
              _color: '#e1e9b0',
              _colorHover: '#e1e9b0',
              _colorResting: '#c3d361',
              _colorSoft: '#e4ebb8',
            },
            geometry: { type: 'Point', coordinates: [-78.88, 42.89] },
          },
        ],
      },
    });
    map.getLayer = vi.fn((id: string) =>
      id === pointLayerId || id === badgeLayerId || id === `${pointLayerId}-selection-badge-outer`
        ? {}
        : undefined
    );
    map.setPaintProperty = vi.fn();

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'buffalo-harbor',
        lngLat: { lng: -78.88, lat: 42.89 },
        properties: { venueId: 'buffalo-harbor', _color: '#e1e9b0' },
      },
      {
        pointLayerId,
        promoteId: 'venueId',
        selectionGroundBadge: true,
        selectionGroundBadgeFallbackColor: '#c3d361',
      }
    );

    const ringData = map._sources.get(`${sourceId}-selection`)?.data as {
      features: Array<{ properties?: Record<string, unknown> }>;
    };
    expect(ringData.features[0]?.properties?._color).toBe('#c3d361');
    expect(map.setPaintProperty).toHaveBeenCalledWith(badgeLayerId, 'circle-color', '#c3d361');
    expect(map.setPaintProperty).toHaveBeenCalledWith(badgeLayerId, 'circle-stroke-color', '#ffffff');
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-badge-outer`,
      'circle-color',
      '#c3d361',
    );
  });

  it('does not re-animate lift when re-selecting the same feature', () => {
    const map = createMockMap();
    const sourceId = 'canvas-venues';
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    map._sources.set(`${sourceId}-selection`, { data: null });
    map.getLayer = vi.fn((id: string) =>
      id === pointLayerId ||
      id === badgeLayerId ||
      id === `${pointLayerId}-selection-badge-outer`
        ? {}
        : undefined
    );
    map.setPaintProperty = vi.fn();
    map.setFilter = vi.fn();
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(performance, 'now').mockReturnValue(1_000);

    const select = () =>
      setSharedPointSelection(
        map as never,
        sourceId,
        {
          featureId: 'dunkirk-dock',
          lngLat: { lng: -79.33, lat: 42.48 },
          properties: { venueId: 'dunkirk-dock', _color: '#9acd32' },
        },
        { pointLayerId, promoteId: 'venueId', selectionGroundBadge: true }
      );

    select();
    const framesAfterFirst = frames.length;
    expect(framesAfterFirst).toBeGreaterThan(0);

    select();
    expect(frames.length).toBe(framesAfterFirst);
  });

  it('lands the grounded badge before filtering off the floating stack', () => {
    const map = createMockMap();
    const sourceId = 'points-test';
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    map._sources.set(`${sourceId}-selection`, { data: null });
    map.getLayer = vi.fn((id: string) =>
      id === pointLayerId ||
      id === badgeLayerId ||
      id === `${pointLayerId}-selection-badge-outer` ||
      id === `${pointLayerId}-selection-ring`
        ? {}
        : undefined
    );
    map.getPaintProperty = vi.fn(() => ['literal', 8]);
    map.setPaintProperty = vi.fn();
    map.setFilter = vi.fn();
    map.moveLayer = vi.fn();
    const order: string[] = [];
    map.setFilter = vi.fn(() => {
      order.push('filter');
    });
    const selectionSource = map._sources.get(`${sourceId}-selection`)!;
    const originalSetData = (data: unknown) => {
      order.push('setData');
      selectionSource.data = data;
    };
    map.getSource = (id: string) => {
      const entry = map._sources.get(id);
      if (!entry) return undefined;
      return {
        _data: entry._data,
        data: entry._data ?? entry.data,
        setData: (data: unknown) => {
          if (id === `${sourceId}-selection`) originalSetData(data);
          else entry.data = data;
        },
      };
    };

    setSharedPointSelection(
      map as never,
      sourceId,
      {
        featureId: 'venue-1',
        lngLat: { lng: -79.08, lat: 43.08 },
        properties: { venueId: 'venue-1', _color: '#9acd32' },
      },
      {
        pointLayerId,
        promoteId: 'venueId',
        selectionGroundBadge: true,
      }
    );

    expect(order.indexOf('setData')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('filter')).toBeGreaterThan(order.indexOf('setData'));
  });

  it('inserts new selection badge disks below the badge icon layer when present', () => {
    const pointLayerId = 'canvas-venues-point';
    const sourceId = 'canvas-venues';
    const iconLayerId = `${pointLayerId}-selection-badge-icon`;
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    const layers = new Set([pointLayerId, iconLayerId]);
    const addLayer = vi.fn();
    setupSelectionGroundBadgeLayers(
      {
        getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
        getLayer: (id: string) => (layers.has(id) ? {} : undefined),
        addLayer,
        setPaintProperty: vi.fn(),
        moveLayer: vi.fn(),
      } as never,
      sourceId,
      pointLayerId,
      { fallbackColor: '#9acd32' }
    );

    const badgeCall = addLayer.mock.calls.find((c) => c[0]?.id === badgeLayerId);
    expect(badgeCall?.[1]).toBe(iconLayerId);
  });

  it('paints selected outer as seam-plug fill plus stroked rim under the white ring', () => {
    const pointLayerId = 'canvas-venues-point';
    const sourceId = 'canvas-venues';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    const badgeOuterLayerId = `${pointLayerId}-selection-badge-outer`;
    const layers = new Map<string, unknown>();
    const addLayer = vi.fn((spec: { id: string; paint?: Record<string, unknown> }, beforeId?: string) => {
      layers.set(spec.id, { beforeId, paint: spec.paint });
    });
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer,
      setPaintProperty: vi.fn(),
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#9acd32',
    });

    const outerCall = addLayer.mock.calls.find((c) => c[0]?.id === badgeOuterLayerId);
    const badgeCall = addLayer.mock.calls.find((c) => c[0]?.id === badgeLayerId);
    expect(outerCall).toBeTruthy();
    expect(badgeCall).toBeTruthy();
    expect(badgeCall?.[1]).toBe(outerCall?.[1]);
    expect(badgeCall?.[1]).not.toBe(badgeOuterLayerId);
    expect(outerCall?.[0]?.paint?.['circle-stroke-width']).not.toBe(0);
    expect(outerCall?.[0]?.paint?.['circle-color']).toBeTruthy();
    expect(outerCall?.[0]?.paint?.['circle-color']).not.toBe('rgba(0,0,0,0)');
    expect(outerCall?.[0]?.paint?.['circle-stroke-color']).toBeTruthy();
  });

  it('animates selection badge translate from resting up to selected', () => {
    const map = createMockMap();
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    const badgeOuterLayerId = `${pointLayerId}-selection-badge-outer`;
    map.getLayer = vi.fn((id: string) =>
      id === badgeLayerId || id === badgeOuterLayerId ? {} : undefined
    );
    map.setPaintProperty = vi.fn();
    // Deep zoom → full float/selected heights from the zoom curve.
    map.getZoom = vi.fn(() => 18);

    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const t0 = 1_000;
    vi.spyOn(performance, 'now').mockReturnValue(t0);

    animateSharedPointSelectionBadgeTranslate(map as never, pointLayerId, {
      durationMs: 100,
    });

    expect(map.setPaintProperty).toHaveBeenCalledWith(
      badgeLayerId,
      'circle-translate',
      SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE
    );

    frames[0]?.(t0);
    expect(frames.length).toBeGreaterThan(1);
    frames[frames.length - 1]?.(t0 + 100);

    const translateCalls = (map.setPaintProperty as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === badgeLayerId && call[1] === 'circle-translate'
    );
    expect(translateCalls[translateCalls.length - 1][2]).toEqual(
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE
    );
    raf.mockRestore();
  });

  it('continues a select lift from the current translate instead of snapping back to rest', () => {
    const map = createMockMap();
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    map.getLayer = vi.fn((id: string) => (id === badgeLayerId ? {} : undefined));
    let currentTranslate: [number, number] = [0, -12];
    map.getPaintProperty = vi.fn((id: string, prop: string) =>
      id === badgeLayerId && prop === 'circle-translate' ? currentTranslate : undefined
    );
    map.setPaintProperty = vi.fn((id: string, prop: string, value: unknown) => {
      if (id === badgeLayerId && prop === 'circle-translate' && Array.isArray(value)) {
        currentTranslate = value as [number, number];
      }
    });
    map.getZoom = vi.fn(() => 18);

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const t0 = 2_000;
    vi.spyOn(performance, 'now').mockReturnValue(t0);

    animateSharedPointSelectionBadgeTranslate(map as never, pointLayerId, {
      durationMs: 100,
    });

    // Must not restart from resting 0 — that is the up→down→up hitch.
    expect(currentTranslate[1]).toBe(-12);
    expect(currentTranslate[1]).not.toBe(SHARED_POINT_FLOATING_BADGE_FLOAT_TRANSLATE[1]);

    frames[frames.length - 1]?.(t0 + 100);
    expect(currentTranslate).toEqual(SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE);
  });

  it('keeps full selected lift at mid zoom so Places fly does not settle the badge down', () => {
    const map = createMockMap();
    const pointLayerId = 'canvas-venues-point';
    const badgeLayerId = `${pointLayerId}-selection-badge`;
    map.getLayer = vi.fn((id: string) => (id === badgeLayerId ? {} : undefined));
    map.setPaintProperty = vi.fn();
    // Places focus lands near z10 — zoom-scaled select height would be ~-10 and look like settle.
    map.getZoom = vi.fn(() => 10);

    const frames: FrameRequestCallback[] = [];
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
    const t0 = 3_000;
    vi.spyOn(performance, 'now').mockReturnValue(t0);

    animateSharedPointSelectionBadgeTranslate(map as never, pointLayerId, {
      durationMs: 100,
    });
    frames[frames.length - 1]?.(t0 + 100);

    const translateCalls = (map.setPaintProperty as ReturnType<typeof vi.fn>).mock.calls.filter(
      (call) => call[0] === badgeLayerId && call[1] === 'circle-translate'
    );
    expect(translateCalls[translateCalls.length - 1][2]).toEqual(
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE
    );
    expect(translateCalls[translateCalls.length - 1][2][1]).toBe(
      SHARED_POINT_FLOATING_BADGE_SELECTED_TRANSLATE[1]
    );
  });
});
