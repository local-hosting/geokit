/**
 * Geolocate Control Component
 * 
 * Provides user location tracking and display
 * 
 * Usage:
 * <mapi-control-geolocate position="top-left" track-user-location="false"></mapi-control-geolocate>
 */

import { BaseControl } from '../base-control';

export class GeolocateControlElement extends BaseControl {
  static observedAttributes = [
    'position',
    'track-user-location',
    'show-accuracy-circle',
    'show-user-heading',
  ];

  protected getDefaultPosition(): string {
    return 'top-left';
  }

  protected async createControl(): Promise<any> {
    const provider = this.getUIProvider();
    
    const options = {
      trackUserLocation: this.getBooleanAttribute('track-user-location', false, false),
      showAccuracyCircle: this.getBooleanAttribute('show-accuracy-circle', false, true),
      showUserHeading: this.getBooleanAttribute('show-user-heading', false, false),
    };

    return provider.createControl('geolocate', options);
  }

  protected setupEventForwarding(): void {
    if (!this.control) return;

    // Forward geolocate events
    this.control.on?.('geolocate', (e: any) => {
      this.dispatchEvent(
        new CustomEvent('geolocate', {
          detail: { position: e, control: this.control },
          bubbles: true,
        })
      );
    });

    this.control.on?.('error', (e: any) => {
      this.dispatchEvent(
        new CustomEvent('geolocate-error', {
          detail: { error: e, control: this.control },
          bubbles: true,
        })
      );
    });

    this.control.on?.('trackuserlocationstart', () => {
      this.dispatchEvent(
        new CustomEvent('track-user-location-start', {
          detail: { control: this.control },
          bubbles: true,
        })
      );
    });

    this.control.on?.('trackuserlocationend', () => {
      this.dispatchEvent(
        new CustomEvent('track-user-location-end', {
          detail: { control: this.control },
          bubbles: true,
        })
      );
    });
  }

  protected handleAttributeChange(name: string, oldValue: string | null, newValue: string | null): void {
    this.handleRecreateableAttributeChange(name, oldValue, newValue, [
      'track-user-location',
      'show-accuracy-circle',
      'show-user-heading',
    ]);
  }
}

// Register custom element
if (!customElements.get('mapi-control-geolocate')) {
  customElements.define('mapi-control-geolocate', GeolocateControlElement);
}

