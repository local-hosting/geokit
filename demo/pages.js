/**
 * Registry for geokit demo pages — nav sidebar and Playwright smoke tests.
 * MCP map host is integration infra (@twinfile/mcp open_map), not a browsable demo.
 * @typedef {{ id: string, path: string, label: string, description?: string }} DemoPage
 * @typedef {{ id: string, label: string, items: DemoPage[] }} DemoSection
 */

/** @type {DemoSection[]} */
export const DEMO_SECTIONS = [
  {
    id: 'maps',
    label: 'Maps',
    items: [
      { id: 'main', path: '/index.html', label: 'Main' },
      { id: 'layers-test', path: '/layers-test.html', label: 'Layers' },
      { id: 'scrolling', path: '/scrolling.html', label: 'Scrolling' },
      { id: 'centered', path: '/centered.html', label: 'Providers' },
    ],
  },
  {
    id: 'cdn',
    label: 'CDN',
    items: [
      { id: 'cdn-hub', path: '/cdn/index.html', label: 'Hub' },
      {
        id: 'fetch',
        path: '/cdn/fetch.html',
        label: 'fetch',
        description: 'fetchGlobeCdn / fetchGlobeCdnJson — raw HTTP + Accept header',
      },
      {
        id: 'paths',
        path: '/cdn/paths.html',
        label: 'paths',
        description: 'URL builders — countyShapeUrl, state cities catalog',
      },
      {
        id: 'bulk',
        path: '/cdn/bulk.html',
        label: 'bulk',
        description: 'counties + states outline FeatureCollections',
      },
      {
        id: 'county',
        path: '/cdn/county.html',
        label: 'county',
        description: 'fetchCountyShapeFeature, fetchCountyShapesForFips',
      },
      {
        id: 'place',
        path: '/cdn/place.html',
        label: 'place',
        description: 'catalog, cities bulk, single place feature',
      },
      {
        id: 'bounds',
        path: '/cdn/bounds.html',
        label: 'bounds',
        description: 'boundsFromFeature / boundsFromFeatures',
      },
      {
        id: 'resolve-shape',
        path: '/cdn/resolve-shape.html',
        label: 'resolve-shape',
        description: 'FIPS, state+place, borough aliases → bounds',
      },
    ],
  },
];

/** Interactive map host for packages/mcp open_map — smoke-tested, not in demo nav. */
export const MCP_MAP_PAGE = '/mcp-map.html';

/** @type {readonly string[]} */
export const DEMO_PAGES = [
  ...DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path)),
  MCP_MAP_PAGE,
];
