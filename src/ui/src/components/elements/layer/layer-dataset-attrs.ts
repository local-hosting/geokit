/**
 * Passthrough dataset attributes from gk-layer markup to mount functions.
 * Geokit forwards app-specific attrs without hardcoding product geography names.
 */

/** Standard gk-layer attributes — not forwarded to dataset mounts. */
export const CORE_GK_LAYER_ATTRS = new Set([
  'source-id',
  'layer-id',
  'type',
  'before-layer-id',
  'promote-id',
  'minzoom',
  'maxzoom',
  'interactive',
  'hover-state',
  'cursor',
  'dataset',
  'layer-dataset',
  'base-url',
  'line-color',
  'line-width',
  'mode',
  'slugs',
  'highlight-slug',
  'fill-opacity',
  'fill-color',
  'outline-color',
  'style',
  'class',
  'id',
]);

export function collectPassthroughDatasetAttrs(element: HTMLElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const { name, value } of Array.from(element.attributes)) {
    if (CORE_GK_LAYER_ATTRS.has(name)) continue;
    if (!value) {
      // Vue boolean attrs (e.g. show-outlines) render as empty string — treat as true.
      if (element.hasAttribute(name)) attrs[name] = 'true';
      continue;
    }
    attrs[name] = value;
  }
  if (element.hasAttribute('dark-variant')) {
    attrs['dark-variant'] = 'true';
  }
  return attrs;
}

export function isPassthroughDatasetAttr(name: string): boolean {
  return !CORE_GK_LAYER_ATTRS.has(name);
}
