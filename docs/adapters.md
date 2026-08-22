# Framework adapters (Vue, React, Svelte)

Geokit map rendering stays in **Web Components** (`gk-map`, …) and **headless controllers** (`geokit/ui/*`). Framework adapters are thin lifecycle glue — same API shape across Vue, React, and Svelte.

## Packages

| Import | Use when |
| --- | --- |
| `geokit/adapters/shared` | Framework-neutral lifecycle + mount policy |
| `geokit/vue` | Vue 3 composables |
| `geokit/react` | React 18+ hooks + `<GkMap>` |
| `geokit/svelte` | Svelte 4+ store-compatible factories |

Peer dependencies (`vue`, `react`, `svelte`) are optional — install only the adapter you use.

## Vue

```ts
import { useGkMap, useGkMapEvents, useGkMapMount } from 'geokit/vue';

const containerRef = ref<HTMLElement | null>(null);
const { shouldMount } = useGkMapMount(containerRef, { mode: 'when-visible-and-idle' });
const { mapElement, isReady, setMapElement } = useGkMap();

useGkMapEvents(mapElement, {
  onClick: (detail) => { /* venue select */ },
});
```

```vue
<div ref="containerRef">
  <gk-map v-if="shouldMount" :ref="el => setMapElement(el)" provider="maptiler" />
</div>
```

## React

```tsx
import {
  GkMap,
  useGkMap,
  useGkMapEvents,
  useGkMapMount,
  useGkMapContainer,
  useGkScrollIdle,
} from 'geokit/react';

function MapCard({ container }: { container: HTMLElement | null }) {
  const { isScrollIdle, start, stop } = useGkScrollIdle();
  const { shouldMount } = useGkMapMount(container, {
    mode: 'when-visible-and-idle',
    isScrollIdle,
  });
  const { setMapElement, mapElement, mapInstance } = useGkMap();
  useGkMapEvents(mapElement, { onClick: d => console.log(d) }, { mapInstance });
  useGkMapContainer(container, { onReady: ({ map }) => console.log('ready', map) });

  if (!shouldMount) return null;
  return <GkMap ref={setMapElement} provider="maptiler" />;
}
```

## Svelte

```svelte
<script lang="ts">
  import { createGkMap, createGkMapMount } from 'geokit/svelte';
  import { onDestroy } from 'svelte';

  let container: HTMLElement;
  const mount = createGkMapMount({ mode: 'when-visible-and-idle' });
  const gkMap = createGkMap();

  $: mount.start(container);
  $: gkMap.setMapElement(mapEl);

  let mapEl: HTMLElement | undefined;
  onDestroy(() => { mount.destroy(); gkMap.destroy(); });
</script>

<div bind:this={container}>
  {#if $mount.shouldMount}
    <gk-map bind:this={mapEl} provider="maptiler"></gk-map>
  {/if}
</div>
```

## Shared headless API

```ts
import { bindGkMapLifecycle, createMapMountPolicy } from 'geokit/adapters/shared';
```

- `bindGkMapLifecycle(element, handlers)` — subscribe to `gk-map-ready`, `gk-map-unload`, freeze/unfreeze
- `createMapMountPolicy({ mode })` — `immediate` | `when-visible` | `when-visible-and-idle`

Map layer logic remains in `geokit/ui/*` (shared-points, choropleth controllers, etc.).
