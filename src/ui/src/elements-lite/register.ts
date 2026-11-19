/**
 * Side-effect entry: define gk-map, gk-point, and gk-h3 without the full UI barrel.
 *
 * Pair with `@local-hosting/geokit/ui/elements-lite` (configure, MapElement types, utilities).
 * Does not register gk-layer, isochrones, map-collection, or crosswalk-backed point layers.
 */

import '../components/elements/map/map';
import '../components/elements/point/point-visual';
import '../components/elements/h3';