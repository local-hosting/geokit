/**
 * Marker Component
 *
 * Displays markers on the map with optional popups
 *
 * Usage:
 * <mapi-marker lat="40.7128" lng="-74.006" popup="true" title="New York"></mapi-marker>
 */

import { MapChildElement } from '../map-child-element';
import { getCSSVariable } from '../../utils/theme';

export class MarkerElement extends MapChildElement {
  static observedAttributes = ['lat', 'lng', 'title', 'popup', 'color', 'draggable', 'visible'];

  private marker: any = null;
  private popupInstance: any = null;

  async connectedCallback(): Promise<void> {
    if (this.isInitialized) return;

    // Call super which handles addToParentMap() and base initialization
    await super.connectedCallback();
  }

  protected async onMapReady(): Promise<void> {
    await super.onMapReady();
    this.createMarker();
  }

  private createMarker(): void {
    if (!this.map || this.getAttribute('visible') === 'false') return;

    // Remove existing marker
    this.removeMarker();

    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');

    if (!lat || !lng) {
      console.warn('Marker: lat and lng attributes are required');
      return;
    }

    // Create marker
    const provider = this.getUIProvider();
    const options = {
      color: this.getAttribute('color') || getCSSVariable(this.mapElement, '--gk-marker-color', ''),
      draggable: this.getAttribute('draggable') === 'true',
    };

    this.marker = provider.createMarker(options);
    this.marker.setLngLat([lng, lat]);
    this.marker.addTo(this.map);

    // Add popup if requested
    const hasPopup = this.hasAttribute('popup');
    const title = this.getAttribute('title');

    if (hasPopup && title) {
      this.addPopup(title);
    }

    // Set up events
    this.setupMarkerEvents();

    // Dispatch created event
    this.dispatchEvent(
      new CustomEvent('marker-created', {
        detail: { marker: this.marker, lat, lng },
        bubbles: true,
      })
    );
  }

  private addPopup(content: string): void {
    if (!this.marker) return;

    const provider = this.getUIProvider();
    this.popupInstance = provider.createPopup({
      offset: 25,
      closeButton: true,
      closeOnClick: true,
    });

    this.popupInstance.setHTML(content);
    this.marker.setPopup(this.popupInstance);
  }

  private setupMarkerEvents(): void {
    if (!this.marker) return;

    const element = this.marker.getElement();
    if (!element) return;

    element.addEventListener('click', (e: Event) => {
      this.dispatchEvent(
        new CustomEvent('marker-click', {
          detail: { marker: this.marker, originalEvent: e },
          bubbles: true,
        })
      );
    });

    // Handle drag events
    if (this.getAttribute('draggable') === 'true') {
      this.marker.on?.('dragend', () => {
        const lngLat = this.marker.getLngLat();
        this.setAttribute('lat', lngLat.lat.toString());
        this.setAttribute('lng', lngLat.lng.toString());

        this.dispatchEvent(
          new CustomEvent('marker-dragend', {
            detail: { marker: this.marker, lat: lngLat.lat, lng: lngLat.lng },
            bubbles: true,
          })
        );
      });
    }
  }

  private removeMarker(): void {
    if (this.marker) {
      this.marker.remove();
      this.marker = null;
    }
    if (this.popupInstance) {
      this.popupInstance.remove();
      this.popupInstance = null;
    }
  }

  disconnectedCallback(): void {
    this.removeMarker();
    this.isInitialized = false;
  }

  protected handleAttributeChange(
    name: string,
    _oldValue: string | null,
    _newValue: string | null
  ): void {
    if (!this.map) return;

    switch (name) {
      case 'lat':
      case 'lng':
        this.updatePosition();
        break;
      case 'title':
        this.updatePopup();
        break;
      case 'visible':
        this.toggleVisibility();
        break;
      case 'color':
      case 'draggable':
        this.createMarker();
        break;
    }
  }

  private updatePosition(): void {
    if (!this.marker) return;

    const lat = parseFloat(this.getAttribute('lat') || '0');
    const lng = parseFloat(this.getAttribute('lng') || '0');

    this.marker.setLngLat([lng, lat]);
  }

  private updatePopup(): void {
    if (!this.marker) return;

    const hasPopup = this.hasAttribute('popup');
    const title = this.getAttribute('title');

    if (this.popupInstance) {
      this.marker.setPopup(null);
      this.popupInstance = null;
    }

    if (hasPopup && title) {
      this.addPopup(title);
    }
  }

  private toggleVisibility(): void {
    const visible = this.getAttribute('visible') !== 'false';
    if (visible) {
      if (!this.marker) {
        this.createMarker();
      }
    } else {
      this.removeMarker();
    }
  }

  // Public API
  public getMarker(): any {
    return this.marker;
  }

  public getPosition(): { lat: number; lng: number } {
    if (this.marker) {
      const lngLat = this.marker.getLngLat();
      return { lat: lngLat.lat, lng: lngLat.lng };
    }
    return {
      lat: parseFloat(this.getAttribute('lat') || '0'),
      lng: parseFloat(this.getAttribute('lng') || '0'),
    };
  }

  public setPosition(lat: number, lng: number): void {
    this.setAttribute('lat', lat.toString());
    this.setAttribute('lng', lng.toString());
  }
}

// Register custom element
if (!customElements.get('gk-marker')) {
  customElements.define('gk-marker', MarkerElement);
}
