/**
 * Map Component
 * 
 * Main map container component
 * 
 * Usage:
 * <mapi-map lat="40.7128" lng="-74.006" zoom="10" style="streets"></mapi-map>
 */

import { BaseElement } from '../base-element';
import { registerUIProvider, setUIProvider, getUIProvider as getRegistryUIProvider } from '../../providers/registry';
import { MapTilerUIProvider } from '../../providers/maptiler-provider';

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
  ];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.map = null;
    this.isInitialized = false;
    this.setupShadowDOM();
  }

  setupShadowDOM(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        #container {
          width: 100%;
          height: 100%;
          position: relative;
        }
        
        #map {
          width: 100%;
          height: 100%;
        }
        
        #loading {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: #666;
          font-family: system-ui, -apple-system, sans-serif;
          z-index: 1000;
        }
        
        #loading.hidden {
          display: none;
        }
      </style>
      
      <div id="container">
        <div id="loading">Loading map...</div>
        <div id="map"></div>
      </div>
    `;
  }

  async connectedCallback(): Promise<void> {
    if (!this.isInitialized) {
      await this.initializeMap();
    }
  }

  async initializeMap(): Promise<void> {
    try {
      // Auto-initialize MapTiler provider if api-key is present and no provider is set
      const apiKey = this.getAttribute('api-key');
      try {
        this.getUIProvider(); // Check if provider exists
      } catch (err) {
        // No provider set, auto-initialize MapTiler if we have an API key
        if (apiKey) {
          console.log('[geokit] Auto-initializing MapTiler provider from api-key attribute');
          registerUIProvider('maptiler', new MapTilerUIProvider());
          await setUIProvider('maptiler', { apiKey });
        } else {
          throw new Error('No UI provider set and no api-key attribute found. Either set a UI provider or add api-key attribute to <mapi-map>');
        }
      }
      
      const provider = this.getUIProvider();
      const container = this.shadowRoot?.querySelector('#map') as HTMLElement;
      
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

      // Hide loading indicator
      const loading = this.shadowRoot?.querySelector('#loading');
      if (loading) {
        loading.classList.add('hidden');
      }

      // Wait for map to be fully loaded
      this.map.on('load', () => {
        this.isInitialized = true;
        this.dispatchEvent(
          new CustomEvent('mapi-ready', {
            detail: { map: this.map },
            bubbles: true,
          })
        );
      });
    } catch (error) {
      console.error('Failed to initialize map:', error);
      const loading = this.shadowRoot?.querySelector('#loading');
      if (loading) {
        loading.textContent = 'Failed to load map';
      }
    }
  }

  protected handleAttributeChange(name: string, _oldValue: string | null, newValue: string | null): void {
    if (!this.map || !newValue) return;

    switch (name) {
      case 'lat':
      case 'lng':
        this.updateCenter();
        break;
      case 'zoom':
        this.map.setZoom(parseFloat(newValue));
        break;
      case 'pitch':
        this.map.setPitch(parseFloat(newValue));
        break;
      case 'bearing':
        this.map.setBearing(parseFloat(newValue));
        break;
    }
  }

  private updateCenter(): void {
    if (!this.map) return;
    
    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');
    
    this.map.setCenter([lng, lat]);
  }

  // Public API
  public getMap(): any {
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
    
    this.map.flyTo({
      center: [lng, lat],
      zoom: zoom !== undefined ? zoom : this.map.getZoom(),
    });
  }
}

// Register custom element
if (!customElements.get('mapi-map')) {
  customElements.define('mapi-map', MapElement);
}

