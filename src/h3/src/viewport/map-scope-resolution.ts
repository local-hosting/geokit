/** H3 index maximum resolution (h3-js). */
const H3_INDEX_MAX_RESOLUTION = 15;

/**
 * Coarsest H3 resolution for map scope overlays, pan-lock, and max-bounds derivation.
 * Matches country-scale geo scope (res 2) — hemispheric / continental cells (0–1) are forbidden.
 */
export const H3_MAP_SCOPE_MIN_RESOLUTION = 2;

export function clampMapScopeH3Resolution(resolution: number): number {
  const rounded = Math.round(resolution);
  if (!Number.isFinite(rounded)) {
    throw new Error('h3 resolution must be finite');
  }
  return Math.min(H3_INDEX_MAX_RESOLUTION, Math.max(H3_MAP_SCOPE_MIN_RESOLUTION, rounded));
}