# MapTiler SDK – point layer rendering

When using MapTiler SDK with shared glow + point layers (e.g. `createSharedPointLayers`), the **point (circle) layer can fail to render** if it uses too many or too complex data-driven expressions. We observed the glow layer rendering (e.g. 163 features in viewport) while the point layer rendered 0.

## How to avoid the problem

1. **Keep the point layer minimal**
   - Use only **circle-color** (data-driven) and **circle-radius** (zoom interpolation) as expressions.
   - Keep **circle-opacity** and **circle-blur** static (e.g. `1` and `0`).

2. **Add the point layer on top**
   - Do **not** pass `beforeLayerId` when adding the point layer so it draws above the glow.

3. **Provide a static fallback**
   - If `addLayer` throws (e.g. expression rejected), add the point layer with static paint (fixed radius, color, opacity) so dots still appear.

See the JSDoc on `createSharedPointLayers` in `src/ui/utils/layer-styles.ts` for the in-code note.
