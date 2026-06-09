/**
 * Registry for geokit demo pages — nav sidebar and Playwright smoke tests.
 * @typedef {{ id: string, path: string, label: string, description?: string }} DemoPage
 * @typedef {{ id: string, label: string, items: DemoPage[] }} DemoSection
 */

/** @type {DemoSection[]} */
export const DEMO_SECTIONS = [
  {
    id: 'maps',
    label: 'Maps',
    items: [
      { id: 'main', path: '/maps/index.html', label: 'Main' },
      { id: 'layers-test', path: '/maps/layers-test.html', label: 'Layers' },
      {
        id: 'selection',
        path: '/maps/selection.html',
        label: 'Selection',
        description: 'Shared-point ring on click, setSelectedPoint, gk-point focus',
      },
      { id: 'scrolling', path: '/maps/scrolling.html', label: 'Scrolling' },
      { id: 'centered', path: '/maps/centered.html', label: 'Providers' },
    ],
  },
  {
    id: 'cdn',
    label: 'CDN',
    items: [
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
      {
        id: 'dma',
        path: '/cdn/dma.html',
        label: 'dma',
        description: 'DMA paths, JWT check, regional shards — /markets/dma/** (Bearer auth)',
      },
    ],
  },
];

/** @type {readonly string[]} */
export const DEMO_PAGES = DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
