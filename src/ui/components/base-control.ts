/**
 * Base Control Component
 *
 * Base class for all control components
 * Provides common utilities for attribute handling
 */

import { MapChildElement } from './map-child-element';

/**
 * Base class for all map control components
 * Extends MapChildElement to find parent map and handle lifecycle
 */
export class BaseControl extends MapChildElement {
  /**
   * Get a boolean attribute value
   * Handles common patterns: 'true' string, 'false' string, or default value
   */
  protected getBooleanAttribute(
    name: string,
    defaultValue: boolean = false,
    defaultTrue: boolean = false
  ): boolean {
    const value = this.getAttribute(name);

    if (value === null || value === undefined) {
      return defaultTrue ? true : defaultValue;
    }

    if (defaultTrue) {
      // For attributes that default to true (like show-compass, show-zoom)
      return value !== 'false';
    }

    // For attributes that default to false (like track-user-location)
    return value === 'true' || value === '';
  }

  /**
   * Handle attribute changes that require control recreation
   * Common pattern used by navigation, fullscreen, and geolocate controls
   */
  protected handleRecreateableAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null,
    recreateableAttributes: string[]
  ): void {
    // Call parent method for position handling
    super.handleAttributeChange(name, oldValue, newValue);

    // Handle control-specific attributes that require recreation
    if (recreateableAttributes.includes(name) && this.control && this.map) {
      this.recreateControl();
    }
  }

  /**
   * Check if control is ready for operations
   */
  protected isControlReady(): boolean {
    return !!(this.control && this.map);
  }
}
