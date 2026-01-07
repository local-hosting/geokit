/**
 * Map Component
 *
 * Main map container component
 *
 * Usage:
 * <mapi-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></mapi-map>
 */

import { BaseElement } from '../base-element';
import { registerUIProvider, setUIProvider } from '../../providers/registry';
import { MapTilerUIProvider } from '../../providers/maptiler-provider';
import { simplifyPolygonRingToMaxPoints } from '../../../utils/simplify';
import type { LatLon } from '../../../types';
import type { MapInstance } from '../../providers/types';

export class MapElement extends BaseElement {
  static observedAttributes = [
    'lat',
    'lng',
    'zoom',
    'min-zoom',
    'max-zoom',
    'style',
    'pitch',
    'bearing',
    'interactive',
    'hide-controls',
  ];

  constructor() {
    super();
    this.map = null;
    this.isInitialized = false;
  }

  async connectedCallback(): Promise<void> {
    // Setup DOM structure if not already present
    if (!this.querySelector('.gk-map-container')) {
      const container = document.createElement('div');
      container.className = 'gk-map-container';
      container.style.width = '100%';
      container.style.height = '100%';
      container.style.position = 'relative';
      this.appendChild(container);
    }

    // Prevent re-initialization if map already exists (important for map pool reuse)
    // When maps are moved between cards, connectedCallback can be called again,
    // but we should reuse the existing map instance to avoid creating new WebGL contexts
    if (!this.isInitialized && !this.map) {
      await this.initializeMap();
    } else if (this.map && !this.isInitialized) {
      // Map exists but not marked as initialized - mark it as initialized
      // This can happen if the map was created but the load event hasn't fired yet
      this.isInitialized = true;
    }
  }

  /**
   * Override disconnectedCallback to preserve map instance when element is moved
   * This is critical for map pool reuse - we don't want to destroy the map instance
   * when the element is moved between cards, only when it's permanently removed
   *
   * For map pool reuse, we preserve the map instance so it can be reused.
   * The map will only be cleaned up if explicitly removed via remove() or similar.
   */
  disconnectedCallback(): void {
    // Don't call super.disconnectedCallback() because it resets this.map = null
    // We want to preserve the map instance for reuse in the map pool
    // Only clean up if we have a flag indicating permanent removal
    // For now, we preserve the map instance - it will be cleaned up
    // when the element is actually removed from the DOM permanently
    // (which doesn't happen in map pool reuse scenarios)
  }

  async initializeMap(): Promise<void> {
    try {
      // Auto-initialize MapTiler provider if api-key is present and no provider is set
      const apiKey = this.getAttribute('api-key');
      try {
        this.getUIProvider(); // Check if provider exists
      } catch {
        // No provider set, auto-initialize MapTiler if we have an API key
        if (apiKey) {
          console.warn('[geokit] Auto-initializing MapTiler provider from api-key attribute');
          registerUIProvider('maptiler', new MapTilerUIProvider());
          await setUIProvider('maptiler', { apiKey });
        } else {
          throw new Error(
            'No UI provider set and no api-key attribute found. Either set a UI provider or add api-key attribute to <mapi-map>'
          );
        }
      }

      const provider = this.getUIProvider();
      const container = this.querySelector('.gk-map-container') as HTMLElement;

      if (!container) {
        throw new Error('Map container not found');
      }

      const options = {
        lat: parseFloat(this.getAttribute('lat') || '0'),
        lng: parseFloat(this.getAttribute('lng') || '0'),
        zoom: parseFloat(this.getAttribute('zoom') || '2'),
        pitch: parseFloat(this.getAttribute('pitch') || '0'),
        bearing: parseFloat(this.getAttribute('bearing') || '0'),
        style: this.getAttribute('style') || undefined,
        interactive: this.getAttribute('interactive') !== 'false',
      };

      this.map = await provider.createMap(container, options);

      // Check if map is already loaded (style might load synchronously or very fast)
      // Use try-catch because isStyleLoaded may access properties that don't exist yet
      let styleAlreadyLoaded = false;
      try {
        const isStyleLoaded = (this.map as { isStyleLoaded?: () => boolean }).isStyleLoaded;
        if (isStyleLoaded && this.map) {
          styleAlreadyLoaded = isStyleLoaded.call(this.map);
        }
      } catch {
        // Map not ready yet, will wait for load event
        styleAlreadyLoaded = false;
      }

      if (styleAlreadyLoaded) {
        // Style already loaded, wait for idle event to ensure control system is ready
        this.isInitialized = true;
        this.map.once('idle', () => {
          this.dispatchEvent(
            new CustomEvent('mapi-ready', {
              detail: { map: this.map, element: this },
              bubbles: true,
            })
          );
        });
      } else {
        // Wait for map to be fully loaded, then wait for idle
        this.map.on('load', () => {
          this.isInitialized = true;
          // Wait for idle to ensure internal control system is initialized
          this.map!.once('idle', () => {
            this.dispatchEvent(
              new CustomEvent('mapi-ready', {
                detail: { map: this.map, element: this },
                bubbles: true,
              })
            );
          });
        });
      }
    } catch (error) {
      console.error('Failed to initialize map:', error);
    }
  }

  protected handleAttributeChange(
    name: string,
    _oldValue: string | null,
    newValue: string | null
  ): void {
    if (!this.map || !newValue) return;

    switch (name) {
      case 'lat':
      case 'lng':
        this.updateCenter();
        break;
      case 'zoom':
        const setZoom = (this.map as { setZoom?: (zoom: number) => void }).setZoom;
        if (setZoom) {
          setZoom(parseFloat(newValue));
        }
        break;
      case 'pitch':
        const setPitch = (this.map as { setPitch?: (pitch: number) => void }).setPitch;
        if (setPitch) {
          setPitch(parseFloat(newValue));
        }
        break;
      case 'bearing':
        const setBearing = (this.map as { setBearing?: (bearing: number) => void }).setBearing;
        if (setBearing) {
          setBearing(parseFloat(newValue));
        }
        break;
    }
  }

  private updateCenter(): void {
    if (!this.map) return;

    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');

    const setCenter = (this.map as { setCenter?: (center: [number, number]) => void }).setCenter;
    if (setCenter) {
      setCenter([lng, lat]);
    }
  }

  // Public API
  public getMap(): MapInstance | null {
    return this.map;
  }

  public setCenter(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }

  public setZoom(zoom: number): void {
    this.setAttribute('zoom', zoom.toString());
  }

  public flyTo(lat: number, lng: number, zoom?: number): void {
    if (!this.map) return;

    const flyTo = (
      this.map as { flyTo?: (options: { center: [number, number]; zoom: number }) => void }
    ).flyTo;
    const getZoom = (this.map as { getZoom?: () => number }).getZoom;
    if (flyTo) {
      const targetZoom = zoom !== undefined ? zoom : (getZoom?.() ?? 10);
      flyTo({
        center: [lng, lat],
        zoom: targetZoom,
      });
    }
  }

  /**
   * Clear all child elements (points, polygons, etc.)
   * Used by map pool to reset maps when reassigning
   * Ensures proper cleanup by triggering disconnectedCallback on each child
   * Also cleans up any dangling layers/sources in the map
   */
  public clearChildren(): void {
    const map = this.getMap();

    // Remove all children except the ones in shadow DOM
    const children = Array.from(this.children);
    children.forEach((child) => {
      // Trigger cleanup before removing (disconnectedCallback handles layer/source cleanup)
      if (
        typeof (child as HTMLElement & { disconnectedCallback?: () => void })
          .disconnectedCallback === 'function'
      ) {
        try {
          (child as HTMLElement & { disconnectedCallback: () => void }).disconnectedCallback();
        } catch (error) {
          console.warn(`Error in disconnectedCallback for ${child.tagName}:`, error);
        }
      }
      // Remove the element from DOM
      child.remove();
    });

    // Clean up any dangling layers/sources that might not have been cleaned up
    if (map && map.getLayer && map.removeLayer && map.getSource && map.removeSource) {
      try {
        // Get all layers and remove custom ones
        const style = (
          map as { getStyle?: () => { layers?: Array<{ id?: string }> } }
        ).getStyle?.();
        if (style?.layers) {
          style.layers.forEach((layer) => {
            const layerId = layer.id;
            if (
              layerId &&
              (layerId.startsWith('point-') ||
                layerId.startsWith('polygon-') ||
                layerId.startsWith('polyline-') ||
                layerId.startsWith('marker-'))
            ) {
              try {
                if (map.getLayer?.(layerId)) {
                  map.removeLayer?.(layerId);
                }
              } catch {
                // Layer might already be removed
              }
            }
          });
        }

        // Remove custom sources
        if (style && 'sources' in style && style.sources) {
          Object.keys(style.sources as Record<string, unknown>).forEach((sourceId) => {
            if (
              sourceId.startsWith('point-') ||
              sourceId.startsWith('polygon-') ||
              sourceId.startsWith('polyline-') ||
              sourceId.startsWith('marker-')
            ) {
              try {
                if (map.getSource?.(sourceId)) {
                  map.removeSource?.(sourceId);
                }
              } catch {
                // Source might already be removed
              }
            }
          });
        }
      } catch (error) {
        console.warn('Error cleaning up dangling layers/sources:', error);
      }
    }
  }

  /**
   * Get count of child elements by type
   * Used for debugging and verification
   */
  public getChildCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    const children = Array.from(this.children);

    children.forEach((child) => {
      const tagName = child.tagName.toLowerCase();
      counts[tagName] = (counts[tagName] || 0) + 1;
    });

    return counts;
  }

  /**
   * Check if map is currently populating data
   */
  public isPopulating(): boolean {
    return this.hasAttribute('data-populating');
  }

  /**
   * Set whether map is currently populating
   */
  public setPopulating(populating: boolean): void {
    if (populating) {
      this.setAttribute('data-populating', 'true');
    } else {
      this.removeAttribute('data-populating');
    }
  }

  /**
   * Add GeoJSON points to the map
   * Accepts a GeoJSON FeatureCollection and converts to mapi-point elements
   *
   * @param geojson - GeoJSON FeatureCollection with Point features
   * @param options - Optional styling and behavior options
   * @returns Number of points added
   */
  public addPointsFromGeoJSON(
    geojson: GeoJSON.FeatureCollection,
    options: {
      color?: string;
      size?: number;
      opacity?: number;
      blur?: number;
      shadow?: boolean;
      shadowColor?: string;
      shadowBlur?: number;
      shadowOpacity?: number;
      strokeWidth?: number;
      strokeColor?: string;
      idProperty?: string; // Property to use for point-id attribute
      nameProperty?: string; // Property to use for point-name attribute
    } = {}
  ): number {
    const {
      color = '#3b82f6',
      size = 8,
      opacity = 1,
      blur = 0,
      shadow = true,
      shadowColor = '#000000',
      shadowBlur = 1,
      shadowOpacity = 0.15,
      strokeWidth = 0,
      strokeColor = '#ffffff',
      idProperty = 'id',
      nameProperty = 'name',
    } = options;

    let addedCount = 0;

    geojson.features.forEach((feature) => {
      if (feature.geometry.type !== 'Point') {
        console.warn('Skipping non-Point feature:', feature);
        return;
      }

      const [lng, lat] = feature.geometry.coordinates;
      const point = document.createElement('gk-point');

      // Set coordinates
      point.setAttribute('lat', String(lat));
      point.setAttribute('lng', String(lng));

      // Set styling
      point.setAttribute('color', color);
      point.setAttribute('size', String(size));
      point.setAttribute('opacity', String(opacity));
      point.setAttribute('blur', String(blur));

      // Set shadow
      if (shadow) {
        point.setAttribute('shadow', '');
        point.setAttribute('shadow-color', shadowColor);
        point.setAttribute('shadow-blur', String(shadowBlur));
        point.setAttribute('shadow-opacity', String(shadowOpacity));
      }

      // Set stroke
      point.setAttribute('stroke-width', String(strokeWidth));
      if (strokeWidth > 0) {
        point.setAttribute('stroke-color', strokeColor);
      }

      // Set properties from feature
      if (feature.properties) {
        if (idProperty && feature.properties[idProperty]) {
          point.setAttribute('point-id', String(feature.properties[idProperty]));
        }
        if (nameProperty && feature.properties[nameProperty]) {
          point.setAttribute('point-name', String(feature.properties[nameProperty]));
        }

        // Store all properties as data attributes for app use
        point.setAttribute('data-properties', JSON.stringify(feature.properties));
      }

      this.appendChild(point);
      addedCount++;
    });

    return addedCount;
  }

  /**
   * Add GeoJSON polygon to the map
   * Accepts a GeoJSON Feature or Geometry with Polygon/MultiPolygon
   *
   * @param geojson - GeoJSON Feature or Geometry
   * @param options - Optional styling options
   * @returns Number of polygons added
   */
  public addPolygonFromGeoJSON(
    geojson: GeoJSON.Feature | GeoJSON.Geometry,
    options: {
      fillColor?: string;
      fillOpacity?: number;
      strokeColor?: string;
      strokeWidth?: number;
      strokeOpacity?: number;
      visible?: boolean;
      simplify?: boolean;
      maxPoints?: number;
    } = {}
  ): number {
    const {
      fillColor = '#3b82f6',
      fillOpacity = 0.1,
      strokeColor = '#3b82f6',
      strokeWidth = 2,
      strokeOpacity = 1,
      visible = true,
      simplify = true,
      maxPoints = 100,
    } = options;

    let addedCount = 0;

    // Extract geometry from Feature or use directly
    const geometry = 'geometry' in geojson ? geojson.geometry : geojson;

    if (geometry.type === 'Polygon') {
      this._addPolygonRings(geometry.coordinates, {
        fillColor,
        fillOpacity,
        strokeColor,
        strokeWidth,
        strokeOpacity,
        visible,
        simplify,
        maxPoints,
      });
      addedCount = 1;
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygonCoords) => {
        this._addPolygonRings(polygonCoords, {
          fillColor,
          fillOpacity,
          strokeColor,
          strokeWidth,
          strokeOpacity,
          visible,
          simplify,
          maxPoints,
        });
        addedCount++;
      });
    } else {
      console.warn('Unsupported geometry type for polygon:', geometry.type);
    }

    return addedCount;
  }

  /**
   * Helper to add polygon rings (outer + holes)
   * Note: Currently only supports outer ring (holes not supported by mapi-polygon yet)
   */
  private _addPolygonRings(
    coordinates: number[][][],
    options: {
      fillColor: string;
      fillOpacity: number;
      strokeColor: string;
      strokeWidth: number;
      strokeOpacity: number;
      visible: boolean;
      simplify: boolean;
      maxPoints: number;
    }
  ): void {
    // Only process the first ring (outer boundary)
    // Subsequent rings are holes, which mapi-polygon doesn't support yet
    const outerRing = coordinates[0];
    if (!outerRing) {
      console.warn('Polygon has no outer ring');
      return;
    }

    // Convert [lng, lat] to [lat, lng] format for geokit utils
    let points: LatLon[] = outerRing.map(([lng, lat]) => [lat, lng]);

    // Simplify if requested using geokit's Douglas-Peucker algorithm
    if (options.simplify && points.length > options.maxPoints) {
      points = simplifyPolygonRingToMaxPoints(options.maxPoints)(points);
    }

    // Skip if too few points
    if (points.length < 3) {
      console.warn('Skipping polygon ring with fewer than 3 points');
      return;
    }

    // Convert to array format for gk-polygon (it normalizes internally)
    const pointArray = points.map(([lat, lng]) => [lat, lng]);

    const polygon = document.createElement('gk-polygon');
    polygon.setAttribute('points', JSON.stringify(pointArray));
    polygon.setAttribute('fill-color', options.fillColor);
    polygon.setAttribute('fill-opacity', String(options.fillOpacity));
    polygon.setAttribute('stroke-color', options.strokeColor);
    polygon.setAttribute('stroke-width', String(options.strokeWidth));
    polygon.setAttribute('stroke-opacity', String(options.strokeOpacity));
    polygon.setAttribute('visible', String(options.visible));

    this.appendChild(polygon);
  }
}

// Register custom element
if (!customElements.get('gk-map')) {
  customElements.define('gk-map', MapElement);
}
