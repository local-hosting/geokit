// geokit Layer Creation Test - Using Expression Builders
import { mountDemoNavFromDocument } from '../shared/nav.js';
import '../../src/ui/theme.css';

mountDemoNavFromDocument();
import { configure } from '../../src/ui/index.ts';
import { 
  createSharedPointLayers,
  getPointRadiusInterpolation,
  getGlowRadiusInterpolation,
  buildCategoryColorExpression,
  buildCategoryGlowOpacityExpression,
  buildCategoryStrokeWidthExpression,
  buildCategoryRadiusScaleExpression,
  buildRatingOpacityExpression,
  multiplyRadiusExpression
} from '../../src/ui/utils/layer-styles.ts';

// Configure API keys
configure({
  maptiler: { 
    apiKey: import.meta.env.MAPTILER_KEY 
  }
});

const statusEl = document.getElementById('status');

function log(message, type = 'info') {
  console.log(`[LayerTest] ${message}`);
  const div = document.createElement('div');
  div.className = type;
  div.textContent = message;
  statusEl.appendChild(div);
}

function clearStatus() {
  statusEl.innerHTML = '';
}

/** Read a CSS custom property from :root (design in CSS, values used by layer config) */
function getCSSVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function getCSSVarNum(name, fallback) {
  const v = getCSSVar(name, String(fallback));
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

// Wait for map to be ready (gk-map fires 'gk-map-ready' when style is loaded)
const mapElement = document.getElementById('test-map');

mapElement.addEventListener('gk-map-ready', async () => {
  clearStatus();
  log('Map ready!', 'success');
  
  const map = mapElement.getMap();
  if (!map) {
    log('ERROR: Could not get map instance', 'error');
    return;
  }
  
  log(`Map instance obtained: ${!!map}`);

  // Create test GeoJSON data (generic category property: type = default | premium | partner)
  const testVenues = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { slug: 'venue-1', type: 'default', name: 'Los Angeles', averageRating: 4.5 },
        geometry: { type: 'Point', coordinates: [-118.2437, 34.0522] }
      },
      {
        type: 'Feature',
        properties: { slug: 'venue-2', type: 'premium', name: 'Phoenix' },
        geometry: { type: 'Point', coordinates: [-112.0740, 33.4484] }
      },
      {
        type: 'Feature',
        properties: { slug: 'venue-3', type: 'partner', name: 'Denver', averageRating: 3.8 },
        geometry: { type: 'Point', coordinates: [-104.9903, 39.7392] }
      },
      {
        type: 'Feature',
        properties: { slug: 'venue-4', type: 'default', name: 'Chicago' },
        geometry: { type: 'Point', coordinates: [-87.6298, 41.8781] }
      },
      {
        type: 'Feature',
        properties: { slug: 'venue-5', type: 'default', name: 'New York', averageRating: 4.2 },
        geometry: { type: 'Point', coordinates: [-74.006, 40.7128] }
      }
    ]
  };

  // Add source
  const sourceId = 'test-venues';
  log(`Adding source: ${sourceId}`);
  
  try {
    map.addSource(sourceId, {
      type: 'geojson',
      data: testVenues,
      promoteId: 'slug'
    });
    log(`Source added: ${!!map.getSource(sourceId)}`, 'success');
  } catch (e) {
    log(`Failed to add source: ${e.message}`, 'error');
    return;
  }

  // Category style config: values from CSS (--demo-category-*) so design lives in stylesheet
  const categoryConfig = {
    property: 'type',
    categories: {
      premium: {
        color: getCSSVar('--demo-category-premium-color', '#02cb56'),
        glowOpacity: getCSSVarNum('--demo-category-premium-glow-opacity', 0.35),
        strokeWidth: getCSSVarNum('--demo-category-premium-stroke-width', 1.5),
        radiusScale: getCSSVarNum('--demo-category-premium-radius-scale', 1.25),
      },
      partner: {
        color: getCSSVar('--demo-category-partner-color', '#1a73e8'),
        glowOpacity: getCSSVarNum('--demo-category-partner-glow-opacity', 0.35),
        strokeWidth: getCSSVarNum('--demo-category-partner-stroke-width', 2),
        radiusScale: getCSSVarNum('--demo-category-partner-radius-scale', 1.3),
      },
    },
    defaults: {
      color: getCSSVar('--demo-category-default-color', '#ff6b35'),
      glowOpacity: getCSSVarNum('--demo-category-default-glow-opacity', 0.55),
      strokeWidth: getCSSVarNum('--demo-category-default-stroke-width', 0),
      radiusScale: getCSSVarNum('--demo-category-default-radius-scale', 1),
    },
  };

  // Build expressions using geokit builders
  log('Building expressions with geokit builders...');
  
  const colorExpression = buildCategoryColorExpression(categoryConfig);
  log(`Color expr: ${JSON.stringify(colorExpression).slice(0, 60)}...`);
  
  const glowOpacityExpression = buildCategoryGlowOpacityExpression(categoryConfig);
  log(`Glow opacity expr: ${JSON.stringify(glowOpacityExpression).slice(0, 60)}...`);
  
  const strokeWidthExpression = buildCategoryStrokeWidthExpression(categoryConfig);
  log(`Stroke width expr: ${JSON.stringify(strokeWidthExpression).slice(0, 60)}...`);
  
  const radiusScaleExpression = buildCategoryRadiusScaleExpression(categoryConfig);
  log(`Radius scale expr: ${JSON.stringify(radiusScaleExpression).slice(0, 60)}...`);
  
  const circleOpacityExpression = buildRatingOpacityExpression('averageRating');
  log(`Circle opacity expr: ${JSON.stringify(circleOpacityExpression).slice(0, 60)}...`);

  const basePointRadius = getPointRadiusInterpolation({ scale: 1 });
  const pointRadius = multiplyRadiusExpression(basePointRadius, radiusScaleExpression);
  const glowRadius = getGlowRadiusInterpolation({ scale: 1.5 });

  // Create layer IDs
  const glowLayerId = 'test-venue-glow';
  const pointLayerId = 'test-venue-points';

  log(`Creating layers: glow=${glowLayerId}, point=${pointLayerId}`);

  // Call createSharedPointLayers
  try {
    createSharedPointLayers({
      map,
      sourceId,
      glowLayerId,
      pointLayerId,
      circleColor: colorExpression,
      circleOpacity: circleOpacityExpression,
      circleStrokeColor: '#ffffff',
      circleStrokeWidth: strokeWidthExpression,
      glowColor: colorExpression,
      glowOpacity: glowOpacityExpression,
      glowHoverOpacity: 1,
      glowBlur: 1.5,
      pointRadius,
      glowRadius
    });

    // Verify layers were created
    const glowExists = !!map.getLayer(glowLayerId);
    const pointExists = !!map.getLayer(pointLayerId);
    
    log(`Glow layer created: ${glowExists}`, glowExists ? 'success' : 'error');
    log(`Point layer created: ${pointExists}`, pointExists ? 'success' : 'error');

    if (glowExists && pointExists) {
      log('✅ ALL LAYERS CREATED SUCCESSFULLY!', 'success');
      log('Hover over points to test interactions');
    } else {
      log('❌ LAYER CREATION FAILED', 'error');
    }

  } catch (e) {
    log(`createSharedPointLayers threw: ${e.message}`, 'error');
    console.error(e);
  }
});

log('Waiting for gk-map-ready event...');
