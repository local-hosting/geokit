/**
 * Framework-agnostic shared point layer create/sync orchestration.
 */

import type { FeatureCollection } from 'geojson';
import type { ApplySharedPointPaintOptions, SharedPointLayerIds } from '../paint/shared-point-paint';
import { SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR } from '../paint/shared-point-paint';
import {
  ensureSharedPointLayerSetHealed,
  isSharedPointLayerSetFullyComplete,
} from './shared-point-heal';
import { attachSharedPointFloatingBadgePitchLift } from '../paint/shared-point-pitch-lift';
import { applySharedPointLayersAbove3dExtrusions } from '../paint/shared-point/layer-ids';
import {
  attachSharedPointHoverGlowRadiusSync,
  createSharedPointLayersFromPaint,
  ensureSharedPointGeoJsonSource,
  isMapTilerPointHelperAvailable,
  isSharedPointLayerSetComplete,
  removeMapSourcesWithPrefix,
  syncExistingSharedPointLayers,
  tearDownSharedPointLayers,
  waitForSharedPointLayerSetComplete,
} from './shared-point-sync';

export interface SharedPointLayerMap {
  getSource(id: string): { setData?(data: unknown): void } | undefined;
  getLayer(id: string): unknown;
  getStyle?(): { layers?: Array<{ id: string; source?: string }> } | null;
}

export interface SharedPointGkMap {
  getMap?: () => SharedPointLayerMap | null;
  getAttribute?: (name: string) => string | null;
  whenStyleReady?: (timeoutMs: number) => Promise<void>;
  setAttribute?: (name: string, value: string) => void;
}

export interface SharedPointLayerControllerOptions {
  getGkMap: () => SharedPointGkMap | null;
  ids: SharedPointLayerIds | (() => SharedPointLayerIds);
  promoteId?: string;
  getGeoJson: () => FeatureCollection;
  getPaintConfig: () => ApplySharedPointPaintOptions;
  getPaintFingerprint: () => string;
  glowHoverOpacity?: number | (() => number);
  selectionRingColor?: string | (() => string);
  /** Soft drop shadow under the selected point (raised look). */
  selectionShadowColor?: string | (() => string);
  /** Point outline width so the selection ring clears the stroke. */
  selectionPointStrokeWidth?: number | (() => number);
  ensureMapTilerReady?: () => Promise<void>;
  /** Remove other point sources sharing a prefix on first create. */
  pruneSourcePrefix?:
    | { sourcePrefix: string; keepSourceId: string }
    | (() => { sourcePrefix: string; keepSourceId: string } | undefined);
  onAfterCreate?: (map: SharedPointLayerMap) => void | Promise<void>;
  styleReadyTimeoutMs?: number;
}

export interface SharedPointLayerController {
  updateLayers: () => Promise<void>;
  cleanup: () => void;
  isCreated: () => boolean;
}

export function createSharedPointLayerController(
  options: SharedPointLayerControllerOptions
): SharedPointLayerController {
  let layersCreated = false;
  let sourceToleranceVerified = false;
  let lastPaintFingerprint: string | null = null;
  let layerCleanup: (() => void) | null = null;
  /** Bumped per updateLayers — stale awaits must not overwrite a newer paint. */
  let updateGeneration = 0;

  function resolveSharedPointPaintOptions() {
    const glowHoverOpacity =
      typeof options.glowHoverOpacity === 'function'
        ? options.glowHoverOpacity()
        : options.glowHoverOpacity;
    const selectionRingColor =
      typeof options.selectionRingColor === 'function'
        ? options.selectionRingColor()
        : options.selectionRingColor;
    const selectionShadowColor =
      typeof options.selectionShadowColor === 'function'
        ? options.selectionShadowColor()
        : options.selectionShadowColor;
    const selectionPointStrokeWidth =
      typeof options.selectionPointStrokeWidth === 'function'
        ? options.selectionPointStrokeWidth()
        : options.selectionPointStrokeWidth;
    return {
      glowHoverOpacity,
      selectionRingColor,
      selectionShadowColor,
      selectionPointStrokeWidth,
    };
  }

  async function ensureSharedPointLayerSetMounted(
    gkMap: SharedPointGkMap,
    currentMap: SharedPointLayerMap,
    ids: SharedPointLayerIds,
    geojson: FeatureCollection,
    paintConfig: ApplySharedPointPaintOptions
  ): Promise<boolean> {
    const {
      glowHoverOpacity,
      selectionRingColor,
      selectionShadowColor,
      selectionPointStrokeWidth,
    } = resolveSharedPointPaintOptions();
    const mapProvider = gkMap.getAttribute?.('provider');
    const useMapTilerPointHelper = mapProvider === 'maptiler';

    const syncLayers = async (healIncompleteLayerSet: boolean) => {
      await syncExistingSharedPointLayers({
        map: currentMap as never,
        ids,
        geojson,
        paint: paintConfig,
        promoteId: options.promoteId,
        mapProvider,
        useMapTilerPointHelper,
        selectionRingColor,
        selectionShadowColor,
        selectionPointStrokeWidth,
        glowHoverOpacity,
        healIncompleteLayerSet,
      });
    };

    if (!isSharedPointLayerSetComplete(currentMap as never, ids)) {
      await syncLayers(true);
      await waitForSharedPointLayerSetComplete(
        currentMap as never,
        ids,
        () => syncLayers(true),
        options.styleReadyTimeoutMs ?? 4000
      );
    } else {
      // Layers already mounted — still push latest GeoJSON (facet filters, etc.).
      await syncLayers(false);
    }

    if (!isSharedPointLayerSetFullyComplete(currentMap as never, ids)) {
      await ensureSharedPointLayerSetHealed(currentMap as never, ids, {
        paint: paintConfig,
        selectionRingColor,
        selectionPointStrokeWidth,
        glowColorFallback: SHARED_POINT_FLOATING_BADGE_FALLBACK_COLOR,
      });
    }

    return isSharedPointLayerSetFullyComplete(currentMap as never, ids);
  }

  function attachHoverGlowSync(
    currentMap: SharedPointLayerMap,
    ids: SharedPointLayerIds
  ): void {
    layerCleanup?.();
    const stopHover = attachSharedPointHoverGlowRadiusSync(
      currentMap as never,
      ids.glowLayerId
    );
    const stopPitch = attachSharedPointFloatingBadgePitchLift(currentMap as never, ids);
    layerCleanup = () => {
      stopHover();
      stopPitch();
    };
  }


  async function updateLayers(): Promise<void> {
    const generation = ++updateGeneration;
    const gkMap = options.getGkMap();
    if (!gkMap?.getMap?.()) return;

    const paintFingerprintEarly = options.getPaintFingerprint();
    const currentMapEarly = gkMap.getMap?.();
    const idsEarly =
      typeof options.ids === 'function' ? options.ids() : options.ids;
    if (
      layersCreated &&
      paintFingerprintEarly === lastPaintFingerprint &&
      currentMapEarly &&
      isSharedPointLayerSetFullyComplete(currentMapEarly as never, idsEarly)
    ) {
      applySharedPointLayersAbove3dExtrusions(currentMapEarly as never, {
        glowLayerId: idsEarly.glowLayerId,
        pointLayerId: idsEarly.pointLayerId,
      });
      return;
    }

    if (typeof gkMap.whenStyleReady === 'function') {
      try {
        await gkMap.whenStyleReady(options.styleReadyTimeoutMs ?? 3000);
      } catch {
        return;
      }
    }

    if (generation !== updateGeneration) return;

    // Re-read after style-ready — concurrent updates may have newer GeoJSON.
    const paintFingerprint = options.getPaintFingerprint();
    const geojson = options.getGeoJson();
    const paintConfig = options.getPaintConfig();
    const ids = typeof options.ids === 'function' ? options.ids() : options.ids;

    const currentMap = gkMap.getMap?.();
    if (!currentMap) return;

    try {
      const prunePrefix =
        typeof options.pruneSourcePrefix === 'function'
          ? options.pruneSourcePrefix()
          : options.pruneSourcePrefix;
      if (prunePrefix && !layersCreated && currentMap.getStyle) {
        removeMapSourcesWithPrefix(currentMap as never, {
          sourcePrefix: prunePrefix.sourcePrefix,
          keepSourceId: prunePrefix.keepSourceId,
        });
      }

      if (!sourceToleranceVerified && currentMap.getSource(ids.sourceId)) {
        sourceToleranceVerified = true;
        if (tearDownSharedPointLayers(currentMap as never, ids)) {
          layersCreated = false;
          lastPaintFingerprint = null;
        }
      }

      if (currentMap.getSource(ids.sourceId)) {
        sourceToleranceVerified = true;
        const complete = await ensureSharedPointLayerSetMounted(
          gkMap,
          currentMap,
          ids,
          geojson,
          paintConfig
        );
        if (generation !== updateGeneration) return;
        layersCreated = complete;
        lastPaintFingerprint = paintFingerprint;
        if (complete) {
          attachHoverGlowSync(currentMap, ids);
          await options.onAfterCreate?.(currentMap);
          if (generation !== updateGeneration) return;
          gkMap.setAttribute?.('data-before-isochrone-layer', ids.glowLayerId);
        }
        return;
      }

      ensureSharedPointGeoJsonSource(
        currentMap as never,
        ids.sourceId,
        geojson,
        options.promoteId ?? 'id'
      );
      sourceToleranceVerified = true;

      if (
        gkMap.getAttribute?.('provider') === 'maptiler' &&
        !isMapTilerPointHelperAvailable() &&
        options.ensureMapTilerReady
      ) {
        await options.ensureMapTilerReady();
        if (generation !== updateGeneration) return;
      }

      const {
        glowHoverOpacity,
        selectionRingColor,
        selectionShadowColor,
        selectionPointStrokeWidth,
      } = resolveSharedPointPaintOptions();

      await createSharedPointLayersFromPaint({
        map: currentMap as never,
        ids,
        geojson,
        paint: paintConfig,
        glowHoverOpacity,
        selectionRingColor,
        selectionShadowColor,
        selectionPointStrokeWidth,
        promoteId: options.promoteId,
        mapProvider: gkMap.getAttribute?.('provider'),
        useMapTilerPointHelper: gkMap.getAttribute?.('provider') === 'maptiler',
      });
      if (generation !== updateGeneration) return;

      const complete = await ensureSharedPointLayerSetMounted(
        gkMap,
        currentMap,
        ids,
        geojson,
        paintConfig
      );
      if (generation !== updateGeneration) return;
      layersCreated = complete;
      lastPaintFingerprint = paintFingerprint;

      if (complete) {
        attachHoverGlowSync(currentMap, ids);
        await options.onAfterCreate?.(currentMap);
        if (generation !== updateGeneration) return;
        gkMap.setAttribute?.('data-before-isochrone-layer', ids.glowLayerId);
      }
    } catch {
      // map torn down mid-update
    }
  }

  function cleanup(): void {
    layerCleanup?.();
    layerCleanup = null;
    layersCreated = false;
    lastPaintFingerprint = null;
    updateGeneration += 1;
  }

  function isCreated(): boolean {
    return layersCreated;
  }

  return { updateLayers, cleanup, isCreated };
}
