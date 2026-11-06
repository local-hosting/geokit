/**
 * Registry for geokit demo pages — map UI only (boundary/geo layer demos are host-app concerns).
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
      {
        id: 'standalone-kit',
        path: '/maps/standalone-kit.html',
        label: 'Standalone kit',
        description: 'Mock registerLayerDatasetMount + gk-point-layer halos (standalone demo)',
      },
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
    id: 'sdk',
    label: 'SDK',
    items: [
      {
        id: 'h3-coverage',
        path: '/maps/h3-coverage.html',
        label: 'H3 coverage',
        description: 'viewportCoverageCells + filterCellsInCoverage against a fake index',
      },
      {
        id: 'static-map',
        path: '/maps/static-map.html',
        label: 'Static map',
        description: 'MapTiler static snapshot URL builder + image preview',
      },
      {
        id: 'lazy-popup',
        path: '/maps/lazy-popup.html',
        label: 'Lazy popup',
        description: 'preloadPopupModule / getPopupModule deferred popup load',
      },
      {
        id: 'facet-filters',
        path: '/maps/facet-filters.html',
        label: 'Facet filters',
        description: 'buildFacetFilterExpression on a GeoJSON point layer',
      },
      {
        id: 'fit-bounds',
        path: '/maps/fit-bounds.html',
        label: 'Fit bounds',
        description: 'calculateFitBoundsViewport then flyTo on gk-map',
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
    id: 'apps',
    label: 'Apps',
    items: [
      {
        id: 'protomap',
        path: '/protomap/index.html',
        label: 'Protomap',
        description: 'Shareable pin + H3 cells on a Protomaps PMTiles basemap',
      },
    ],
  },
];

/** @type {readonly string[]} */
export const DEMO_PAGES = DEMO_SECTIONS.flatMap((section) => section.items.map((item) => item.path));
