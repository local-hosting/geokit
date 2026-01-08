/// <reference types="vite/client" />

declare global {
  interface ImportMeta {
    readonly env: {
      readonly MAPTILER_API_KEY?: string;
      readonly MAPBOX_ACCESS_TOKEN?: string;
      readonly [key: string]: any;
    };
  }
}

export {};

