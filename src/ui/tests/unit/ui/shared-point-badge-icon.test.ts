import { describe, expect, it, vi } from 'vitest';
import { styleImageLayoutPixels } from '../../../src/utils/map-surface/map-style-images';
import { SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION } from '../../../src/utils/paint/shared-point-paint';
import {
  SHARED_POINT_BADGE_ICON_DISK_FILL,
  SHARED_POINT_BADGE_ICON_PROPERTY,
  ensureSharedPointBadgeIconLayers,
  sharedPointBadgeIconSizeExpression,
  raiseSharedPointBadgeIconLayersOnTop,
  registerBadgeIconImage,
  sharedPointPointBadgeIconLayerId,
  sharedPointSelectionBadgeIconLayerId,
} from '../../../src/utils/paint/shared-point-badge-icon';

describe('shared point badge icon', () => {
  it('registers an image via removeImage then addImage when replacing', () => {
    const removeImage = vi.fn();
    const addImage = vi.fn();
    const map = {
      hasImage: () => true,
      removeImage,
      addImage,
    };

    registerBadgeIconImage(map as never, 'gk-badge-cube', { width: 24, height: 24, data: 'img' });

    expect(removeImage).toHaveBeenCalledWith('gk-badge-cube');
    expect(addImage).toHaveBeenCalledWith(
      'gk-badge-cube',
      { width: 24, height: 24, data: 'img' },
      { pixelRatio: 2 }
    );
  });

  it('adds symbol layers on point + selection sources with _badgeIcon filter', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Map<string, Record<string, unknown>>();
    const addLayer = vi.fn((spec: { id: string; type: string; source?: string; filter?: unknown[]; layout?: Record<string, unknown>; paint?: Record<string, unknown> }) => {
      layers.set(spec.id, spec);
    });
    const map = {
      getSource: (id: string) =>
        id === sourceId || id === `${sourceId}-selection` ? {} : undefined,
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer,
    };

    ensureSharedPointBadgeIconLayers(map as never, {
      sourceId,
      pointLayerId,
    });

    const pointIconId = sharedPointPointBadgeIconLayerId(pointLayerId);
    const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    expect(layers.get(pointIconId)?.type).toBe('symbol');
    expect(layers.get(pointIconId)?.source).toBe(sourceId);
    expect(layers.get(selectionIconId)?.source).toBe(`${sourceId}-selection`);

    const filter = layers.get(selectionIconId)?.filter as unknown[];
    expect(filter[0]).toBe('all');
    expect(filter).toContainEqual(['has', SHARED_POINT_BADGE_ICON_PROPERTY]);
    expect(layers.get(selectionIconId)?.layout?.['icon-image']).toEqual([
      'get',
      SHARED_POINT_BADGE_ICON_PROPERTY,
    ]);
    expect(layers.get(selectionIconId)?.paint?.['icon-opacity']).toBe(1);
  });

  it('fits the glyph inside the core when close in and enlarges it when zoomed out', () => {
    const size = sharedPointBadgeIconSizeExpression();
    const radius = SHARED_POINT_FLOATING_BADGE_RADIUS_EXPRESSION;
    expect(size.slice(0, 3)).toEqual(radius.slice(0, 3));
    for (let i = 3; i < radius.length; i += 2) {
      expect(size[i]).toBe(radius[i]);
      const zoom = radius[i] as number;
      const glyphPx = (size[i + 1] as number) * styleImageLayoutPixels();
      const diskPx = (radius[i + 1] as number) * 2;
      if (zoom >= 14) {
        expect(glyphPx).toBeCloseTo(diskPx * SHARED_POINT_BADGE_ICON_DISK_FILL);
      } else {
        expect(glyphPx).toBeGreaterThan(diskPx * SHARED_POINT_BADGE_ICON_DISK_FILL);
      }
    }
  });

  it('puts icon-translate on paint (style spec rejects it on layout)', () => {
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Map<string, { layout?: Record<string, unknown>; paint?: Record<string, unknown> }>();
    const map = {
      getSource: (id: string) =>
        id === sourceId || id === `${sourceId}-selection` ? {} : undefined,
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: (spec: { id: string; layout?: Record<string, unknown>; paint?: Record<string, unknown> }) => {
        layers.set(spec.id, spec);
      },
    };

    ensureSharedPointBadgeIconLayers(map as never, { sourceId, pointLayerId });

    for (const id of [
      sharedPointPointBadgeIconLayerId(pointLayerId),
      sharedPointSelectionBadgeIconLayerId(pointLayerId),
    ]) {
      const spec = layers.get(id);
      expect(spec?.layout).not.toHaveProperty('icon-translate');
      expect(spec?.layout).not.toHaveProperty('icon-translate-anchor');
      expect(spec?.paint).toHaveProperty('icon-translate');
      expect(spec?.paint?.['icon-translate-anchor']).toBe('viewport');
    }
  });

  it('includes a no-op feature-state paint expr (Mapbox GL #13714)', () => {
    // Symbol layers on a feature-state source without any feature-state paint crash when
    // setPaintProperty / setTerrain runs while hover/selected state exists on that source.
    const pointLayerId = 'canvas-places-point';
    const sourceId = 'canvas-places';
    const layers = new Map<string, { paint?: Record<string, unknown> }>();
    const map = {
      getSource: (id: string) =>
        id === sourceId || id === `${sourceId}-selection` ? {} : undefined,
      getLayer: (id: string) => (layers.has(id) || id === pointLayerId ? {} : undefined),
      addLayer: (spec: { id: string; paint?: Record<string, unknown> }) => {
        layers.set(spec.id, spec);
      },
    };

    ensureSharedPointBadgeIconLayers(map as never, { sourceId, pointLayerId });

    for (const id of [
      sharedPointPointBadgeIconLayerId(pointLayerId),
      sharedPointSelectionBadgeIconLayerId(pointLayerId),
    ]) {
      const paintJson = JSON.stringify(layers.get(id)?.paint ?? {});
      expect(paintJson).toContain('feature-state');
    }
  });

  it('raises selection icon above badge disks', () => {
    const pointLayerId = 'canvas-places-point';
    const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    const badgeOuterId = `${pointLayerId}-selection-badge-outer`;
    const badgeId = `${pointLayerId}-selection-badge`;
    const layerIds = new Set([
      pointLayerId,
      badgeOuterId,
      badgeId,
      selectionIconId,
    ]);
    const moveLayer = vi.fn();
    raiseSharedPointBadgeIconLayersOnTop(
      {
        getLayer: (id: string) => (layerIds.has(id) ? {} : undefined),
        moveLayer,
      } as never,
      pointLayerId
    );

    expect(moveLayer).toHaveBeenCalledWith(badgeOuterId, selectionIconId);
    expect(moveLayer).toHaveBeenCalledWith(badgeId, selectionIconId);
    expect(moveLayer).toHaveBeenCalledWith(selectionIconId);
  });

  it('aligns Mapbox Standard slots before moveLayer when glass is top and glyph is not', () => {
    const pointLayerId = 'canvas-places-point';
    const selectionIconId = sharedPointSelectionBadgeIconLayerId(pointLayerId);
    const glassId = `${pointLayerId}-glass`;
    const slots = new Map<string, string | undefined>([
      [glassId, 'top'],
      [selectionIconId, undefined],
      [pointLayerId, 'top'],
    ]);
    const layerIds = new Set([glassId, selectionIconId, pointLayerId]);
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

    expect(() =>
      raiseSharedPointBadgeIconLayersOnTop(
        {
          getLayer: (id: string) =>
            layerIds.has(id) ? { id, slot: slots.get(id) } : undefined,
          setSlot,
          moveLayer,
        } as never,
        pointLayerId
      )
    ).not.toThrow();

    expect(setSlot).toHaveBeenCalledWith(selectionIconId, 'top');
    expect(moveLayer).toHaveBeenCalledWith(glassId, selectionIconId);
  });
});