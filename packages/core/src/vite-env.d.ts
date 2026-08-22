/// <reference types="vite/client" />

declare global {
  interface ImportMeta {
    readonly env: {
      readonly MAPTILER_KEY?: string;
      readonly MAPBOX_TOKEN?: string;
      readonly [key: string]: any;
    };
  }
}

export {};
