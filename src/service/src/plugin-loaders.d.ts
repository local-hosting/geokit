// Plugins import @twinfile/geokit/service, so typing these specifiers here would cycle the service declaration build.
type PluginModuleLoader = () => Promise<Record<string, unknown>>;

export declare const loadMapTilerPlugin: PluginModuleLoader;
export declare const loadMapboxPlugin: PluginModuleLoader;
export declare const loadFoursquarePlugin: PluginModuleLoader;
export declare const loadGooglePlacesPlugin: PluginModuleLoader;
