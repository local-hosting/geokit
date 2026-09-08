export const US_CROSSWALK_TABLE_NAMES = [
  'h3ToDma',
  'h3R5ToZips',
  'zipToH3R5',
  'geohashToDma',
  'geohashP8ToZips',
  'zipToGeohashP8',
  'dmaToZips',
  'dmaToCounties',
  'countyToDma',
  'zipToState',
  'placeToDma',
  'tractToH3R1',
  'h3R1ToTracts',
] as const;

export type UsCrosswalkTableName = (typeof US_CROSSWALK_TABLE_NAMES)[number];

export const US_CROSSWALK_PRESETS = {
  dma: ['h3ToDma'] as const satisfies readonly UsCrosswalkTableName[],
  geohashDma: ['geohashToDma'] as const satisfies readonly UsCrosswalkTableName[],
  h3Zip: ['h3R5ToZips'] as const satisfies readonly UsCrosswalkTableName[],
  geohashZip: ['geohashP8ToZips'] as const satisfies readonly UsCrosswalkTableName[],
  venueCompose: ['h3ToDma', 'h3R5ToZips', 'zipToState'] as const satisfies readonly UsCrosswalkTableName[],
  geohashVenueCompose: [
    'geohashToDma',
    'geohashP8ToZips',
    'zipToState',
  ] as const satisfies readonly UsCrosswalkTableName[],
  zipResolve: [
    'zipToH3R5',
    'h3ToDma',
    'h3R5ToZips',
    'zipToState',
  ] as const satisfies readonly UsCrosswalkTableName[],
  geohashZipResolve: [
    'zipToGeohashP8',
    'geohashToDma',
    'geohashP8ToZips',
    'zipToState',
  ] as const satisfies readonly UsCrosswalkTableName[],
  place: ['placeToDma'] as const satisfies readonly UsCrosswalkTableName[],
  tractResolve: ['tractToH3R1', 'h3R1ToTracts'] as const satisfies readonly UsCrosswalkTableName[],
  demographicsShard: [
    'h3ToDma',
    'h3R5ToZips',
    'zipToH3R5',
    'zipToState',
    'dmaToZips',
  ] as const satisfies readonly UsCrosswalkTableName[],
} as const;
