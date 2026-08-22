/**
 * Configuration Management
 * Centralized configuration for the entire library
 */

import { resolveMapboxKeyFromEnv, resolveMaptilerKeyFromEnv } from './env/index.js';

export interface GeokitConfig {
  // Default providers
  defaultUIProvider?: string;
  defaultAPIProviders?: {
    isochrone?: string;
    geocoding?: string;
    placeSearch?: string;
    directions?: string;
  };

  // Performance settings
  performance?: {
    enableWorkers?: boolean;
    workerPoolSize?: number;
    cacheSize?: number;
    cacheTTL?: number; // milliseconds
  };

  // API keys and credentials
  apiKeys?: {
    mapbox?: string;
    maptiler?: string;
    google?: string;
    foursquare?: string;
    [provider: string]: string | undefined;
  };

  // Default options
  defaults?: {
    distance?: {
      unit?: 'meters' | 'kilometers' | 'miles';
      algorithm?: 'haversine' | 'vincenty' | 'greatCircle';
    };
    coordinates?: {
      precision?: number; // decimal places
      format?: 'latlon' | 'lonlat';
    };
    clustering?: {
      method?: 'grid' | 'distance';
      threshold?: number;
    };
    geohash?: {
      precision?: number;
    };
    h3?: {
      resolution?: number;
    };
  };

  // Feature flags
  features?: {
    enableAdvancedGeometry?: boolean;
    enableMLClustering?: boolean;
  };

  // Debug settings
  debug?: {
    enabled?: boolean;
    logLevel?: 'error' | 'warn' | 'info' | 'debug';
    logPerformance?: boolean;
  };
}

class ConfigManager {
  private config: GeokitConfig = {};
  private listeners: Array<(config: GeokitConfig) => void> = [];

  /**
   * Set configuration
   */
  set(config: Partial<GeokitConfig>): void {
    this.config = this.mergeConfig(this.config, config);
    this.notifyListeners();
  }

  /**
   * Get configuration value
   */
  get<K extends keyof GeokitConfig>(key: K): GeokitConfig[K] {
    return this.config[key];
  }

  /**
   * Get nested configuration value
   */
  getNested(path: string): any {
    return path.split('.').reduce((obj: any, key) => obj?.[key], this.config as any);
  }

  /**
   * Get full configuration
   */
  getAll(): GeokitConfig {
    return { ...this.config };
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = this.getDefaultConfig();
    this.notifyListeners();
  }

  /**
   * Listen for configuration changes
   */
  onChange(listener: (config: GeokitConfig) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private mergeConfig(base: GeokitConfig, update: Partial<GeokitConfig>): GeokitConfig {
    const result = { ...base };

    for (const [key, value] of Object.entries(update)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key as keyof GeokitConfig] = {
          ...(result[key as keyof GeokitConfig] as any),
          ...value,
        };
      } else {
        result[key as keyof GeokitConfig] = value as any;
      }
    }

    return result;
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.config));
  }

  private getDefaultConfig(): GeokitConfig {
    return {
      defaultUIProvider: 'maptiler',
      defaultAPIProviders: {
        isochrone: 'maptiler',
        geocoding: 'maptiler',
        placeSearch: 'foursquare',
        directions: 'maptiler',
      },
      performance: {
        enableWorkers: true,
        workerPoolSize: navigator?.hardwareConcurrency || 4,
        cacheSize: 1000,
        cacheTTL: 5 * 60 * 1000, // 5 minutes
      },
      defaults: {
        distance: {
          unit: 'meters',
          algorithm: 'haversine',
        },
        coordinates: {
          precision: 6,
          format: 'latlon',
        },
        clustering: {
          method: 'grid',
          threshold: 1000,
        },
        geohash: {
          precision: 10,
        },
        h3: {
          resolution: 9,
        },
      },
      features: {
        enableAdvancedGeometry: true,
        enableMLClustering: false,
      },
      debug: {
        enabled: false,
        logLevel: 'warn',
        logPerformance: false,
      },
    };
  }
}

// Global configuration instance
const configManager = new ConfigManager();

/**
 * Configure the library
 */
export function configure(config: Partial<GeokitConfig>): void {
  configManager.set(config);
}

/**
 * Get configuration value
 */
export function getConfig<K extends keyof GeokitConfig>(key: K): GeokitConfig[K] {
  return configManager.get(key);
}

/**
 * Get nested configuration value
 */
export function getConfigValue(path: string): any {
  return configManager.getNested(path);
}

/**
 * Get all configuration
 */
export function getAllConfig(): GeokitConfig {
  return configManager.getAll();
}

/**
 * Reset configuration to defaults
 */
export function resetConfig(): void {
  configManager.reset();
}

/**
 * Listen for configuration changes
 */
export function onConfigChange(listener: (config: GeokitConfig) => void): () => void {
  return configManager.onChange(listener);
}

/**
 * Initialize configuration from environment or external source
 */
export function initializeConfig(source?: 'env' | 'localStorage' | GeokitConfig): void {
  if (!source) {
    configManager.reset();
    return;
  }

  if (typeof source === 'object') {
    configManager.set(source);
    return;
  }

  if (source === 'env' && typeof process !== 'undefined') {
    const envConfig: Partial<GeokitConfig> = {};

    const mapbox = resolveMapboxKeyFromEnv();
    const maptiler = resolveMaptilerKeyFromEnv();
    if (mapbox) {
      envConfig.apiKeys = { mapbox };
    }
    if (maptiler) {
      envConfig.apiKeys = { ...envConfig.apiKeys, maptiler };
    }
    if (process.env.GEOKIT_DEBUG === 'true') {
      envConfig.debug = { enabled: true };
    }

    configManager.set(envConfig);
  }

  if (source === 'localStorage' && typeof localStorage !== 'undefined') {
    // Load from localStorage
    try {
      const stored = localStorage.getItem('geokit-config');
      if (stored) {
        const config = JSON.parse(stored);
        configManager.set(config);
      }
    } catch (error) {
      console.warn('[gk-config] Failed to load config from localStorage:', error);
    }
  }
}

/**
 * Save current configuration to localStorage
 */
export function saveConfigToLocalStorage(): void {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('geokit-config', JSON.stringify(configManager.getAll()));
    } catch (error) {
      console.warn('[gk-config] Failed to save config to localStorage:', error);
    }
  }
}
