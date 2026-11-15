/**
 * Legacy path showed the Mapbox polygon until zoom/interaction, then tessellated.
 * Disabled: `render="h3"` always uses `prepareIsochroneDisplayData` before `setData`.
 */
export function shouldDeferH3PolygonBeforeTessellation(): boolean {
  return false;
}