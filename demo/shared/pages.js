/**
 * Registry for geokit demo pages — nav sidebar and Playwright smoke tests.
 * @typedef {{ id: string, path: string, label: string, description?: string }} DemoPage
 * @typedef {{ id: string, label: string, items: DemoPage[] }} DemoSection
 */

/** @type {DemoSection[]} */
export const DEMO_SECTIONS = [
  {
    id: 'map',
    label: 'Map',
    items: [
      { id: 'main', path: '/maps/index.html', label: 'Main' },
      { id: 'scrolling', path: '/maps/scrolling.html', label: 'Scrolling' },
      { id: 'centered', path: '/maps/centered.html', label: 'Providers' },
      {
        id: 'h3-viewport',
        path: '/maps/h3-viewport.html',
        label: 'H3 viewport',
        description: 'gk-h3 grid synced to viewport via h3CellsForViewportBounds',
      },
    ],
  },
  {
    id: 'points',
    label: 'Points',
    items: [
      {
        id: 'selection',
        path: '/maps/selection.html',
        label: 'Selection',
        description: 'Shared-point ring on click, setSelectedPoint, gk-point focus',
      },
      {
        id: 'layers-test',
        path: '/maps/layers-test.html',
        label: 'Point layers',
        description: 'MapLibre point layer expressions and category styling',
      },
    ],
  },
  {
    id: 'shapes',
    label: 'Shapes',
    items: [
      {
        id: 'state',
        path: '/cdn/state.html',
        label: 'State',
        description: 'states bulk, single state, state code list',
      },
      {
        id: 'cities',
        path: '/cdn/cities.html',
        label: 'Cities',
        description: 'catalog, cities bulk, single city',
      },
      {
        id: 'county',
        path: '/cdn/county.html',
        label: 'County',
        description: 'counties bulk, single county, FIPS list',
      },
      {
        id: 'dma',
        path: '/maps/dma.html',
        label: 'DMA',
        description: 'gk-layer dma — all (viewport) or one (slug)',
      },
      {
        id: 'paint-hero',
        path: '/maps/paint-hero.html',
        label: 'Paint hero',
        description: 'CONUS hero stack — state lines + DMA viewport on dataviz-dark',
      },
    ],
  },
  {
    id: 'util',
    label: 'Util',
    items: [
      {
        id: 'fetch',
        path: '/cdn/fetch.html',
        label: 'Fetch',
        description: 'fetchGlobeCdn / fetchGlobeCdnJson — raw HTTP + Accept header',
      },
      {
        id: 'paths',
        path: '/cdn/paths.html',
        label: 'Paths',
        description: 'URL builders — countyShapeUrl, state cities catalog',
      },
      {
        id: 'bounds',
        path: '/cdn/bounds.html',
        label: 'Bounds',
        description: 'boundsFromFeature / boundsFromFeatures',
      },
      {
        id: 'resolve-shape',
        path: '/cdn/resolve-shape.html',
        label: 'Resolve shape',
        description: 'FIPS, state+place, borough aliases → bounds',
      },
    ],
  },
];

/** @type {readonly string[]} */
export const DEMO_PAGES = DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
