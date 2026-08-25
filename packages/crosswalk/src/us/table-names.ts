export const US_CROSSWALK_TABLE_NAMES = [
  'h3ToDma',
  'h3R5ToZips',
  'zipToH3R5',
  'dmaToZips',
  'dmaToCounties',
  'countyToDma',
  'dmaRegion',
  'zipToState',
  'placeToDma',
] as const;

export type UsCrosswalkTableName = (typeof US_CROSSWALK_TABLE_NAMES)[number];

export const US_CROSSWALK_PRESETS = {
  dma: ['h3ToDma'] as const satisfies readonly UsCrosswalkTableName[],
  h3Zip: ['h3R5ToZips'] as const satisfies readonly UsCrosswalkTableName[],
  venueCompose: ['h3ToDma', 'h3R5ToZips', 'zipToState'] as const satisfies readonly UsCrosswalkTableName[],
  zipResolve: [
    'zipToH3R5',
    'h3ToDma',
    'h3R5ToZips',
    'zipToState',
    'dmaRegion',
  ] as const satisfies readonly UsCrosswalkTableName[],
  place: ['placeToDma', 'dmaRegion'] as const satisfies readonly UsCrosswalkTableName[],
} as const;
