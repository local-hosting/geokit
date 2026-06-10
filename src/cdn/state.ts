import type { GlobeCdnFetchOptions } from './fetch';
import { fetchGlobeCdnJson } from './fetch';
import { resolveGlobeCdnBaseUrl } from './config';
import { fetchStatesBulkGeoJson } from './bulk';
import { stateShapeUrl } from './paths';

export function normalizeStateCode(code: string): string {
  return code.trim().toLowerCase();
}

function slugifyStateHint(hint: string): string {
  return hint.trim().toLowerCase().replace(/\s+/g, '-');
}

export function stateFeatureMatchesHint(feature: GeoJSON.Feature, hint: string): boolean {
  const props = feature.properties ?? {};
  const target = normalizeStateCode(hint);
  const slugTarget = slugifyStateHint(hint);

  const candidates = [
    props.stateCode,
    props.STUSPS,
    props.stusps,
    props.state,
    props.STATE,
    props.slug,
    props.name,
    props.GEOID,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase());

  const nameSlug = slugifyStateHint(String(props.name ?? props.slug ?? ''));
  if (nameSlug) {
    candidates.push(nameSlug);
  }

  return candidates.includes(target) || candidates.includes(slugTarget);
}

export async function fetchStateShapeFeature(
  stateCode: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const normalized = normalizeStateCode(stateCode);
  const base = resolveGlobeCdnBaseUrl(options?.baseUrl);
  const feature = await fetchGlobeCdnJson<GeoJSON.Feature>(
    stateShapeUrl(base, normalized),
    options
  );
  return feature?.geometry ? feature : null;
}

export async function resolveUsStateShapeFeature(
  hint: string,
  options?: GlobeCdnFetchOptions
): Promise<GeoJSON.Feature | null> {
  const normalized = normalizeStateCode(hint);

  if (/^[a-z]{2}$/.test(normalized)) {
    const direct = await fetchStateShapeFeature(normalized, options);
    if (direct) return direct;
  }

  const bulk = await fetchStatesBulkGeoJson(options);
  const match = bulk?.features.find((feature: GeoJSON.Feature) =>
    stateFeatureMatchesHint(feature, hint)
  );
  return match?.geometry ? match : null;
}
