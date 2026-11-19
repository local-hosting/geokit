import { describe, expect, it, vi } from 'vitest';

import { setupSelectionGroundBadgeLayers } from '../../../src/utils/layers/styles/shared-point-layers';
import {
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE,
  sampleZoomInterpolateValue,
  sharedPointFloatingBadgeOuterDiscRadius,
  sharedPointFloatingBadgeOuterStrokeWidthExpression,
  sharedPointFloatingBadgePaintExpressions,
  sharedPointFloatingBadgeRingWidthExpression,
} from '../../../src/utils/shared-point-paint';

const outerDisc = sharedPointFloatingBadgeOuterDiscRadius(
  SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION,
  sharedPointFloatingBadgeRingWidthExpression(),
  sharedPointFloatingBadgeOuterStrokeWidthExpression()
) as unknown[];

function paint() {
  return sharedPointFloatingBadgePaintExpressions({ fallbackColor: '#908ac7', themeElement: null });
}

describe('floating badge drop shadow', () => {
  it('stays round and casts in one screen-space direction when the map is pitched', () => {
    const p = paint();
    expect(p.glowPitchAlignment).toBe('viewport');
    expect(p.glowPitchScale).toBe('viewport');
    expect(p.glowTranslateAnchor).toBe('viewport');
    // Single light source: slight SE cast (positive X + Y in viewport space).
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[0]).toBeGreaterThan(0);
    expect(SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1]).toBeGreaterThan(
      SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[0]
    );
  });

  it('peeks below the full badge (fill + ring + outer band) at city and street zoom', () => {
    const shadow = paint().glowRadiusExpression as unknown[];
    for (const zoom of [14, 16]) {
      const badge = sampleZoomInterpolateValue(outerDisc, zoom);
      const radius = sampleZoomInterpolateValue(shadow, zoom);
      expect(radius).toBeGreaterThanOrEqual(badge);
      expect(radius + SHARED_POINT_FLOATING_BADGE_SHADOW_TRANSLATE[1] * 0.9).toBeGreaterThanOrEqual(
        badge + 8
      );
    }
  });

  it('hugs the badge when zoomed out (no fat disks)', () => {
    const shadow = paint().glowRadiusExpression as unknown[];
    expect(
      sampleZoomInterpolateValue(shadow, 6) - sampleZoomInterpolateValue(outerDisc, 6)
    ).toBeLessThanOrEqual(1.25);
  });

  it('screen-aligns the selected badge shadow too', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Set<string>();
    const setPaintProperty = vi.fn();
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
      setPaintProperty,
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#908ac7',
    });

    const shadowId = `${pointLayerId}-selection-shadow`;
    expect(setPaintProperty).toHaveBeenCalledWith(shadowId, 'circle-pitch-alignment', 'viewport');
    expect(setPaintProperty).toHaveBeenCalledWith(shadowId, 'circle-pitch-scale', 'viewport');
  });

  it('keeps selected shadow on the same zoom-scaled cast as resting (no jump on click)', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Set<string>();
    const setPaintProperty = vi.fn();
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: vi.fn((spec: { id: string }) => layers.add(spec.id)),
      setPaintProperty,
      setFilter: vi.fn(),
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#908ac7',
    });

    const shadowId = `${pointLayerId}-selection-shadow`;
    const translateCall = setPaintProperty.mock.calls.find(
      (c) => c[0] === shadowId && c[1] === 'circle-translate'
    );
    expect(translateCall?.[2]?.[0]).toBe('interpolate');
    expect(setPaintProperty).toHaveBeenCalledWith(
      shadowId,
      'circle-translate-anchor',
      'viewport'
    );
  });

  it('casts selection shadow for every marker shape (not circle-only)', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Set<string>();
    const added: Array<{ id: string; filter?: unknown }> = [];
    const setFilter = vi.fn();
    const setPaintProperty = vi.fn();
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: vi.fn((spec: { id: string; filter?: unknown }) => {
        layers.add(spec.id);
        added.push(spec);
      }),
      setPaintProperty,
      setFilter,
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#908ac7',
    });

    const shadow = added.find((s) => s.id === `${pointLayerId}-selection-shadow`);
    expect(shadow).toBeTruthy();
    // Same as resting glow — soft circle cast under rounded-rect and circle alike.
    expect(shadow?.filter == null || shadow?.filter === undefined).toBe(true);
    // Clear under-shadow — selection cast is visible (not a spare opacity-0 layer).
    expect(setPaintProperty).toHaveBeenCalledWith(
      `${pointLayerId}-selection-shadow`,
      'circle-opacity',
      expect.any(Number)
    );
    const opacityCall = setPaintProperty.mock.calls.find(
      (c) => c[0] === `${pointLayerId}-selection-shadow` && c[1] === 'circle-opacity'
    );
    expect(opacityCall?.[2]).toBeGreaterThan(0);
  });

  it('inserts selection shadow under glass/outer — not between outer ring and fill', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const glassId = `${pointLayerId}-glass`;
    const outerId = `${pointLayerId}-outer-stroke`;
    const layers = new Set<string>([pointLayerId, outerId, glassId]);
    const addLayer = vi.fn((spec: { id: string }, beforeId?: string) => {
      layers.add(spec.id);
      return { id: spec.id, beforeId };
    });
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) => (layers.has(id) ? { id } : undefined),
      addLayer,
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      moveLayer: vi.fn(),
    };

    setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
      fallbackColor: '#908ac7',
    });

    const shadowCall = addLayer.mock.calls.find(
      (c) => c[0]?.id === `${pointLayerId}-selection-shadow`
    );
    expect(shadowCall?.[1]).toBe(glassId);
  });

  it('aligns Mapbox Standard slots before healing selection shadow under glass', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const glassId = `${pointLayerId}-glass`;
    const shadowId = `${pointLayerId}-selection-shadow`;
    const slots = new Map<string, string | undefined>([
      [glassId, 'top'],
      [shadowId, undefined],
      [pointLayerId, 'top'],
    ]);
    const layers = new Set<string>([pointLayerId, glassId, shadowId]);
    const setSlot = vi.fn((id: string, slot?: string | null) => {
      slots.set(id, slot ?? undefined);
    });
    const moveLayer = vi.fn((id: string, beforeId?: string) => {
      if (beforeId == null) return;
      if (slots.get(id) !== slots.get(beforeId)) {
        throw new Error(
          `Layer with id "${beforeId}" has a different slot. Layers can only be rearranged within the same slot.`
        );
      }
    });
    const map = {
      getSource: (id: string) => (id === `${sourceId}-selection` ? {} : undefined),
      getLayer: (id: string) =>
        layers.has(id) ? { id, slot: slots.get(id) } : undefined,
      addLayer: vi.fn(),
      setPaintProperty: vi.fn(),
      setFilter: vi.fn(),
      setSlot,
      moveLayer,
    };

    expect(() =>
      setupSelectionGroundBadgeLayers(map as never, sourceId, pointLayerId, {
        fallbackColor: '#908ac7',
      })
    ).not.toThrow();

    expect(setSlot).toHaveBeenCalledWith(shadowId, 'top');
    expect(moveLayer).toHaveBeenCalledWith(shadowId, glassId);
  });
});
