import { setupMapsDemo } from '../shared/bootstrap-maps.js';

await setupMapsDemo({
  elements: ['point', 'polygon', 'navigation-control'],
});
