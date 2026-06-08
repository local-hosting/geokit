import type { Bounds } from '../types';
import { boundsFromFeature } from './bounds';
import { fetchCountyShapeFeature } from './county';
import { fetchStatePlaceFeature } from './place';

export type GlobeShapeRef = { countyFips: string } | { state: string; place: string };

export type ResolveShapeBoundsOptions = {
  baseUrl?: string;
  init?: RequestInit;
};

export async function resolveShapeBounds(
  ref: GlobeShapeRef,
  options?: ResolveShapeBoundsOptions
): Promise<Bounds | null> {
  const fetchOptions = { baseUrl: options?.baseUrl, init: options?.init };

  const feature =
    'countyFips' in ref
      ? await fetchCountyShapeFeature(ref.countyFips, fetchOptions)
      : await fetchStatePlaceFeature(ref.state, ref.place, fetchOptions);

  if (!feature) return null;
  return boundsFromFeature(feature);
}

export const BOROUGH_COUNTY_ALIASES: Record<string, { state: string; countyFips: string }> = {
  brooklyn: { state: 'ny', countyFips: '36047' },
  queens: { state: 'ny', countyFips: '36081' },
  manhattan: { state: 'ny', countyFips: '36061' },
  bronx: { state: 'ny', countyFips: '36005' },
  'staten-island': { state: 'ny', countyFips: '36085' },
};

export async function resolvePlaceOrBoroughBounds(
  stateCode: string,
  placeSlug: string,
  options?: ResolveShapeBoundsOptions
): Promise<Bounds | null> {
  const state = stateCode.trim().toLowerCase();
  const slug = placeSlug.trim().toLowerCase();

  const fromPlace = await resolveShapeBounds({ state, place: slug }, options);
  if (fromPlace) return fromPlace;

  const borough = BOROUGH_COUNTY_ALIASES[slug];
  if (borough && borough.state === state) {
    return resolveShapeBounds({ countyFips: borough.countyFips }, options);
  }

  return null;
}
