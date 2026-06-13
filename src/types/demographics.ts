/**
 * Demographics data shapes for catalog-loaded ZIP tables and polygon aggregation.
 * Vendor fetch lives in pipeline enrichment → host catalogs, not API providers.
 */

export type DemographicField =
  | 'basic'
  | 'age'
  | 'language'
  | 'ethnicity'
  | 'internet'
  | 'commute'
  | 'occupation'
  | 'phone'
  | 'vehicles';

export interface DemographicsOptions {
  latitude?: number;
  longitude?: number;
  zipcode?: string;
  address?: string;
  radiusMiles?: number;
  polygon?: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  bounds?: [number, number, number, number];
  travelMode?: 'driving' | 'walking' | 'cycling';
  travelTimeMinutes?: number;
  aggregate?: boolean;
  fields?: DemographicField[];
}

export interface DemographicsResult {
  totalPopulation?: number;
  populationDensity?: number;
  medianAge?: number;
  medianHouseholdIncome?: number;
  medianHomeValue?: number;
  medianRent?: number;
  averageHouseholdSize?: number;
  ownerOccupiedPct?: number;
  renterOccupiedPct?: number;
  topGeneration?: string;
  topGenerationPct?: number;
  secondGeneration?: string;
  secondGenerationPct?: number;
  topLanguage?: string;
  topLanguagePct?: number;
  secondLanguage?: string;
  secondLanguagePct?: number;
  otherLanguages?: { name: string; pct: number }[];
  topEthnicity?: string;
  topEthnicityPct?: number;
  secondEthnicity?: string;
  secondEthnicityPct?: number;
  broadbandPct?: number;
  cellularOnlyPct?: number;
  noInternetPct?: number;
  droveAlonePct?: number;
  carpoolPct?: number;
  publicTransitPct?: number;
  workedFromHomePct?: number;
  professionalPct?: number;
  servicePct?: number;
  salesOfficePct?: number;
  constructionPct?: number;
  productionPct?: number;
  landlinePct?: number;
  cellphoneOnlyPct?: number;
  noPhonePct?: number;
  noVehiclePct?: number;
  oneVehiclePct?: number;
  twoOrMoreVehiclesPct?: number;
  selfEmployedPct?: number;
  zipcode?: string;
  dataSource?: string;
  year?: number;
  lastUpdated?: string;
  aggregatedZipcodes?: string[];
  [key: string]: unknown;
}
