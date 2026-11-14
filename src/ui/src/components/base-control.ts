/**
 * Base Control Component
 *
 * Base class for all control components
 * Provides common utilities for attribute handling
 */

import { booleanAttributeChanged, parseBooleanAttribute } from './boolean-attr';
import { MapChildElement } from './map-child-element';

/**
 * Base class for all map control components
 * Extends MapChildElement to find parent map and handle lifecycle
 */
export class BaseControl extends MapChildElement {
  /**
   * Get a boolean attribute value.
   * @param defaultWhenAbsent — value when the attribute is missing (show-compass defaults true)
   */
  protected getBooleanAttribute(name: string, defaultWhenAbsent: boolean = false): boolean {
    return parseBooleanAttribute(this.getAttribute(name), defaultWhenAbsent);
  }

  /**
   * Handle attribute changes that require control recreation
   * Common pattern used by navigation, fullscreen, and geolocate controls
   *
   * @param booleanDefaults — for boolean attrs, skip recreate when parsed value is unchanged
   *   (e.g. null → "true" for default-true attrs)
   */
  protected handleRecreateableAttributeChange(
    name: string,
    oldValue: string | null,
    newValue: string | null,
    recreateableAttributes: string[],
    booleanDefaults?: Record<string, boolean>
  ): void {
    // Call parent method for position handling
    super.handleAttributeChange(name, oldValue, newValue);

    if (!recreateableAttributes.includes(name) || !this.control || !this.map) {
      return;
    }

    if (booleanDefaults && name in booleanDefaults) {
      if (!booleanAttributeChanged(oldValue, newValue, booleanDefaults[name]!)) {
        return;
      }
    }

    void this.recreateControl();
  }

  /**
   * Check if control is ready for operations
   */
  protected isControlReady(): boolean {
    return !!(this.control && this.map);
  }
}
