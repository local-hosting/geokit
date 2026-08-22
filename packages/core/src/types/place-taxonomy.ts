export type PlaceSearchProvider = 'foursquare' | 'google-places';

export type GeotypeRef = string;

export type ResolvedGeotype = {
  acronym: string;
  slug: string;
};

export interface PlaceTaxonomyResolver {
  resolve(ref: GeotypeRef): ResolvedGeotype | null;
  toProviderCategories(refs: GeotypeRef[], provider: PlaceSearchProvider): string[];
  fromProviderCategory(value: string, provider: PlaceSearchProvider): string | null;
}
