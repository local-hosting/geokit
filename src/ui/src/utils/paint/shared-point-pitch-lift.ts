/**
 * Pitch-scaled floating-badge lift — angled cameras need more screen-space Y
 * or markers look stuck into building roofs.
 */
import type { MapInstance } from '../../providers/types';
import {
  floatingBadgeRoundedRestingLayerIds,
  setFloatingBadgeSelectionLift,
} from '../markers/marker-stack';
import { sharedPointCircleBodyLayerIds } from '../markers/marker-shape';
import { selectionBadgeAnimByMap } from '../layers/styles/shared-point/animation-state';
import {
  resolveSharedPointFloatingBadgeTokens,
  sharedPointFloatingBadgeNormalizeViewportTranslate,
  sharedPointFloatingBadgeTranslateExpression,
  sharedPointGlassLayerId,
  type SharedPointLayerIds,
} from './shared-point-paint';

/**
 * Extra lift multiplier at pitch 90° (sin = 1).
 * At 60° → factor ≈ 1 + boost * 0.866.
 */
export const SHARED_POINT_FLOATING_BADGE_PITCH_LIFT_BOOST = 2;

/** 1 at nadir; grows with sin(pitch) so angled cameras raise the badge more. */
export function sharedPointFloatingBadgePitchLiftFactor(pitchDegrees: number): number {
  const raw = Number.isFinite(pitchDegrees) ? pitchDegrees : 0;
  const clamped = Math.min(85, Math.max(0, raw));
  return 1 + SHARED_POINT_FLOATING_BADGE_PITCH_LIFT_BOOST * Math.sin((clamped * Math.PI) / 180);
}

/** Scale a token float/selected Y by the current camera pitch. */
export function sharedPointFloatingBadgeFloatYForPitch(
  baseY: number,
  pitchDegrees: number
): number {
  return baseY * sharedPointFloatingBadgePitchLiftFactor(pitchDegrees);
}

function restingFloatLayerIds(pointLayerId: string): string[] {
  return [
    ...sharedPointCircleBodyLayerIds(pointLayerId),
    sharedPointGlassLayerId(pointLayerId),
    ...floatingBadgeRoundedRestingLayerIds(pointLayerId),
  ];
}

/** Mapbox `getLayer` reads `style.getOwnLayer` — throws when style is mid-swap / gone. */
function tryGetLayer(
  map: MapInstance,
  layerId: string
): { type?: string } | undefined {
  try {
    return map.getLayer?.(layerId) as { type?: string } | undefined;
  } catch {
    return undefined;
  }
}

function setRestingBadgeTranslate(
  map: MapInstance,
  pointLayerId: string,
  translate: [number, number] | unknown[]
): void {
  if (!map.setPaintProperty) return;
  const screenTranslate = sharedPointFloatingBadgeNormalizeViewportTranslate(translate);
  for (const layerId of restingFloatLayerIds(pointLayerId)) {
    const layer = tryGetLayer(map, layerId);
    if (!layer) continue;
    const prefix = layer.type === 'symbol' ? 'icon' : 'circle';
    try {
      map.setPaintProperty(layerId, `${prefix}-translate-anchor`, 'viewport');
      map.setPaintProperty(layerId, `${prefix}-translate`, screenTranslate);
    } catch {
      /* style swap */
    }
  }
}

function selectionAnimActive(map: MapInstance, pointLayerId: string): boolean {
  return selectionBadgeAnimByMap.get(map)?.has(pointLayerId) === true;
}

const pitchLiftCleanupByMap = new WeakMap<MapInstance, Map<string, () => void>>();

/**
 * Keep resting (and settled selection) float height in sync with camera pitch.
 * Shadow stays on the geo point — only badge layers lift.
 */
export function attachSharedPointFloatingBadgePitchLift(
  map: MapInstance,
  ids: Pick<SharedPointLayerIds, 'pointLayerId'>
): () => void {
  const { pointLayerId } = ids;
  let byLayer = pitchLiftCleanupByMap.get(map);
  if (!byLayer) {
    byLayer = new Map();
    pitchLiftCleanupByMap.set(map, byLayer);
  }
  byLayer.get(pointLayerId)?.();

  let disposed = false;
  let pendingFrame: ReturnType<typeof requestAnimationFrame> | null = null;

  const apply = (): void => {
    pendingFrame = null;
    if (disposed) return;
    try {
      const pitch = map.getPitch?.() ?? 0;
      const tokens = resolveSharedPointFloatingBadgeTokens();
      const floatY = sharedPointFloatingBadgeFloatYForPitch(tokens.floatTranslate[1], pitch);
      const selectedY = sharedPointFloatingBadgeFloatYForPitch(tokens.selectedTranslate[1], pitch);
      setRestingBadgeTranslate(map, pointLayerId, sharedPointFloatingBadgeTranslateExpression(floatY));
      if (!selectionAnimActive(map, pointLayerId)) {
        setFloatingBadgeSelectionLift(
          map,
          { pointLayerId },
          sharedPointFloatingBadgeTranslateExpression(selectedY)
        );
      }
    } catch {
      /* map/style torn down during terrain or HMR remount */
    }
  };

  /** Coalesce paint writes off Mapbox's transform/render path (pitch/zoom fire mid-frame). */
  const schedule = (): void => {
    if (disposed || pendingFrame != null) return;
    pendingFrame = requestAnimationFrame(apply);
  };

  map.on?.('pitch', schedule);
  map.on?.('pitchend', schedule);
  // Zoom stops are inside the translate expression — re-apply after style heal.
  map.on?.('zoom', schedule);
  map.on?.('styledata', schedule);
  schedule();

  const cleanup = (): void => {
    disposed = true;
    if (pendingFrame != null) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = null;
    }
    map.off?.('pitch', schedule);
    map.off?.('pitchend', schedule);
    map.off?.('zoom', schedule);
    map.off?.('styledata', schedule);
    byLayer?.delete(pointLayerId);
  };
  byLayer.set(pointLayerId, cleanup);
  return cleanup;
}
