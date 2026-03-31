/**
 * Plugin System for Extensibility
 * Allows third-party extensions and custom functionality
 */

export interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  install: (geokit: any) => void | Promise<void>;
  uninstall?: (geokit: any) => void | Promise<void>;
}

export interface PluginRegistry {
  [name: string]: Plugin;
}

class PluginManager {
  private plugins: PluginRegistry = {};
  private installed: Set<string> = new Set();
  private geokit: any;

  constructor(geokit: any) {
    this.geokit = geokit;
  }

  /**
   * Register a plugin
   */
  register(plugin: Plugin): void {
    if (this.plugins[plugin.name]) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins[plugin.name] = plugin;
  }

  /**
   * Install a plugin
   */
  async install(name: string): Promise<void> {
    const plugin = this.plugins[name];
    if (!plugin) {
      throw new Error(`Plugin "${name}" not found`);
    }

    if (this.installed.has(name)) {
      console.warn(`Plugin "${name}" is already installed`);
      return;
    }

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.installed.has(dep)) {
          throw new Error(`Plugin "${name}" requires "${dep}" to be installed first`);
        }
      }
    }

    // Install the plugin
    await plugin.install(this.geokit);
    this.installed.add(name);
    
    console.log(`Plugin "${name}" v${plugin.version} installed successfully`);
  }

  /**
   * Uninstall a plugin
   */
  async uninstall(name: string): Promise<void> {
    const plugin = this.plugins[name];
    if (!plugin) {
      throw new Error(`Plugin "${name}" not found`);
    }

    if (!this.installed.has(name)) {
      console.warn(`Plugin "${name}" is not installed`);
      return;
    }

    // Check if other plugins depend on this one
    for (const [installedName, installedPlugin] of Object.entries(this.plugins)) {
      if (this.installed.has(installedName) && 
          installedPlugin.dependencies?.includes(name)) {
        throw new Error(`Cannot uninstall "${name}" - "${installedName}" depends on it`);
      }
    }

    // Uninstall the plugin
    if (plugin.uninstall) {
      await plugin.uninstall(this.geokit);
    }
    this.installed.delete(name);
    
    console.log(`Plugin "${name}" uninstalled successfully`);
  }

  /**
   * Get list of installed plugins
   */
  getInstalled(): string[] {
    return Array.from(this.installed);
  }

  /**
   * Get list of available plugins
   */
  getAvailable(): string[] {
    return Object.keys(this.plugins);
  }

  /**
   * Check if plugin is installed
   */
  isInstalled(name: string): boolean {
    return this.installed.has(name);
  }
}

// Global plugin manager instance
let pluginManager: PluginManager | null = null;

/**
 * Initialize plugin system
 */
export function initializePlugins(geokit: any): PluginManager {
  if (!pluginManager) {
    pluginManager = new PluginManager(geokit);
  }
  return pluginManager;
}

/**
 * Get the plugin manager
 */
export function getPluginManager(): PluginManager {
  if (!pluginManager) {
    throw new Error('Plugin system not initialized. Call initializePlugins() first.');
  }
  return pluginManager;
}

/**
 * Example plugins
 */

/**
 * Advanced routing plugin using external service
 */
export const AdvancedRoutingPlugin: Plugin = {
  name: 'advanced-routing',
  version: '1.0.0',
  dependencies: [],
  install: async (geokit) => {
    // Add advanced routing functions to geokit
    geokit.routing = {
      optimizeMultipleRoutes: async (waypoints: any[], options: any) => {
        // Implementation would integrate with routing service
        console.log('Advanced routing installed');
        return [];
      },
      calculateTrafficAwareRoute: async (start: any, end: any) => {
        // Implementation would use traffic data
        return null;
      }
    };
  },
  uninstall: (geokit) => {
    delete geokit.routing;
  }
};

/**
 * Machine learning clustering plugin
 */
export const MLClusteringPlugin: Plugin = {
  name: 'ml-clustering',
  version: '1.0.0',
  dependencies: [],
  install: async (geokit) => {
    // Add ML-based clustering
    geokit.ml = {
      dbscanCluster: (points: any[], options: any) => {
        // Implementation would use DBSCAN algorithm
        console.log('ML clustering installed');
        return [];
      },
      kmeansCluster: (points: any[], k: number) => {
        // Implementation would use K-means
        return [];
      }
    };
  },
  uninstall: (geokit) => {
    delete geokit.ml;
  }
};

/**
 * Real-time tracking plugin
 */
export const RealTimeTrackingPlugin: Plugin = {
  name: 'realtime-tracking',
  version: '1.0.0',
  dependencies: [],
  install: async (geokit) => {
    geokit.tracking = {
      startTracking: (options: any) => {
        console.log('Real-time tracking started');
        return {
          stop: () => console.log('Tracking stopped'),
          getPosition: () => ({ lat: 0, lng: 0 })
        };
      }
    };
  },
  uninstall: (geokit) => {
    delete geokit.tracking;
  }
};