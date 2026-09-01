import type {
  CountryCode,
  CountyFips,
  DMA,
  DmaSlug,
  MacroRegion,
  PlaceKey,
  StateCode,
  ZipCode,
} from '../../types/geo-identity';
import {
  normalizeCountyFipsDigits,
  normalizeKebabSlug,
  normalizePlaceKey,
  normalizeStateCode,
  normalizeZipDigits,
} from './normalize';

export function asDmaSlug(raw: string): DmaSlug {
  const slug = normalizeKebabSlug(raw);
  if (!slug) throw new Error(`Invalid DMA slug: ${raw}`);
  return slug as DmaSlug;
}

export function asDmaSlugOrUndefined(raw: string | null | undefined): DmaSlug | undefined {
  const slug = normalizeKebabSlug(raw);
  return slug ? (slug as DmaSlug) : undefined;
}

/** @deprecated Use {@link asDmaSlugOrUndefined}. */
export const canonicalDmaSlug = asDmaSlugOrUndefined;

export function asZipCode(raw: string): ZipCode {
  const zip = normalizeZipDigits(raw);
  if (!zip) throw new Error(`Invalid ZIP code: ${raw}`);
  return zip as ZipCode;
}

export function asZipCodeOrUndefined(raw: string | null | undefined): ZipCode | undefined {
  const zip = normalizeZipDigits(raw);
  return zip ? (zip as ZipCode) : undefined;
}

export function asCountyFips(raw: string): CountyFips {
  const fips = normalizeCountyFipsDigits(raw);
  if (!fips) throw new Error(`Invalid county FIPS: ${raw}`);
  return fips as CountyFips;
}

export function asCountyFipsOrUndefined(raw: string | null | undefined): CountyFips | undefined {
  const fips = normalizeCountyFipsDigits(raw);
  return fips ? (fips as CountyFips) : undefined;
}

export function asStateCode(raw: string): StateCode {
  const code = normalizeStateCode(raw);
  if (!code) throw new Error(`Invalid state code: ${raw}`);
  return code as StateCode;
}

export function asStateCodeOrUndefined(raw: string | null | undefined): StateCode | undefined {
  const code = normalizeStateCode(raw);
  return code ? (code as StateCode) : undefined;
}

export function asPlaceKey(raw: string): PlaceKey {
  const key = normalizePlaceKey(raw);
  if (!key) throw new Error(`Invalid place key: ${raw}`);
  return key as PlaceKey;
}

export function asPlaceKeyOrUndefined(raw: string | null | undefined): PlaceKey | undefined {
  const key = normalizePlaceKey(raw);
  return key ? (key as PlaceKey) : undefined;
}

export function asMacroRegion(raw: string): MacroRegion {
  const region = normalizeKebabSlug(raw);
  if (!region) throw new Error(`Invalid macro-region: ${raw}`);
  return region as MacroRegion;
}

export function asMacroRegionOrUndefined(raw: string | null | undefined): MacroRegion | undefined {
  const region = normalizeKebabSlug(raw);
  return region ? (region as MacroRegion) : undefined;
}

export function asCountryCode(raw: string): CountryCode {
  const code = raw.trim().toLowerCase();
  if (!code) throw new Error(`Invalid country code: ${raw}`);
  return code as CountryCode;
}

export function asDMA(slug: DmaSlug, region: MacroRegion): DMA {
  return { slug, region };
}

export function asDMAOrUndefined(
  slug: string | null | undefined,
  region: string | null | undefined
): DMA | undefined {
  const dmaSlug = asDmaSlugOrUndefined(slug);
  if (!dmaSlug) return undefined;
  const macroRegion = asMacroRegionOrUndefined(region) ?? ('unknown' as MacroRegion);
  return asDMA(dmaSlug, macroRegion);
}
