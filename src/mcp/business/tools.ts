import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { haversineMeters } from '@twinfile/geokit/distance';
import type { ResolvedMapStaticProvider } from '../../types/map-static-provider.js';
import type { AreaComparisonRow, NearbyPlaceRow } from '../../types/mcp-business.js';
import type { MapHostRegionLayer } from '../../types/mcp-map.js';
import {
  fetchDirections,
  fetchIsochrone,
  fetchNearbyPlaces,
  fetchReverseGeocode,
} from './api-fetch.js';
import {
  formatAreaSqMiles,
  formatDriveTime,
  formatInteractiveMapLink,
  formatStraightLineDistance,
  markdownTable,
  metersToMiles,
  milesToMeters,
} from './format.js';
import { businessMapContent, renderBusinessMap } from './map-snapshot.js';
import { resolveMcpMapTheme } from '../map-presentation.js';
import { resolveMcpRegionPathStyle } from '../map-presentation.js';
import { circleOverlay, markerOverlay, polygonOverlay } from './overlays.js';
import { resolveDmaMarketFromCatalog } from '../../cdn/dma-catalog.js';
import { dmaSlugFromQuery } from '../../cdn/dma.js';
import { resolveGlobeCdnFetchOptions } from '../globe-cdn-fetch-options.js';
import { geocodePlaceQuery, resolvePlaceInput, resolveShowMapContext } from './resolve-place.js';
import {
  mcpError,
  mcpSuccess,
  placeInputFromRaw,
  readOptionalNumber,
  readOptionalString,
  runMcpTool,
} from './tool-result.js';

function mcpMapResult(snapshot: Awaited<ReturnType<typeof renderBusinessMap>>): CallToolResult {
  const { text, imageBase64, mimeType } = businessMapContent(snapshot);
  const content: CallToolResult['content'] = [{ type: 'text', text }];
  if (imageBase64) {
    content.push({
      type: 'image',
      data: imageBase64,
      mimeType: mimeType ?? 'image/png',
    });
  }
  if (snapshot.hostUrl) {
    content.push({ type: 'text', text: formatInteractiveMapLink(snapshot.hostUrl) });
  }
  return {
    content,
    structuredContent: {
      summary: snapshot.summary,
      lat: snapshot.lat,
      lng: snapshot.lng,
      zoom: snapshot.zoom,
      imageUrl: snapshot.imageUrl,
      hostUrl: snapshot.hostUrl,
      interactiveMapUrl: snapshot.hostUrl,
    },
  };
}

const METERS_PER_MILE = 1609.344;

function circleAreaSqMiles(radiusMeters: number): number {
  const radiusMiles = radiusMeters / METERS_PER_MILE;
  return Math.PI * radiusMiles * radiusMiles;
}

async function resolvePlaceFromRaw(raw: Record<string, unknown>) {
  return resolvePlaceInput(placeInputFromRaw(raw));
}

export async function handleShowMap(
  raw: Record<string, unknown>,
  provider: ResolvedMapStaticProvider,
  hostBaseUrl: string,
  options?: { cdnBaseUrl?: string }
): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const place = readOptionalString(raw, 'place', 'query');
    const lat = readOptionalNumber(raw, 'lat');
    const lng = readOptionalNumber(raw, 'lng');

    let resolved: Awaited<ReturnType<typeof resolveShowMapContext>>['place'];
    let regionGeometry: GeoJSON.Geometry | undefined;
    let regionLayer: MapHostRegionLayer | undefined;

    if (lat != null && lng != null) {
      resolved = {
        lat,
        lng,
        label:
          readOptionalString(raw, 'label') ??
          place?.trim() ??
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        scope: 'point',
      };
    } else {
      const context = await resolveShowMapContext(place ?? '', { cdnBaseUrl: options?.cdnBaseUrl });
      resolved = context.place;
      regionGeometry = context.regionGeometry;
      regionLayer = context.regionLayer;
    }

    const frameRegion = resolved.scope === 'region' && resolved.bounds != null;
    const label = readOptionalString(raw, 'label') ?? resolved.label;
    const zoom = readOptionalNumber(raw, 'zoom') ?? (frameRegion ? undefined : 12);
    const bounds = resolved.bounds;
    const cdnOptions = resolveGlobeCdnFetchOptions({ cdnBaseUrl: options?.cdnBaseUrl });
    if (!regionLayer && place != null && /\bdma\b/i.test(place)) {
      const dmaSlug = dmaSlugFromQuery(place);
      if (dmaSlug) {
        const catalogMarket = await resolveDmaMarketFromCatalog(dmaSlug, cdnOptions);
        regionLayer = {
          dataset: 'dma',
          slug: catalogMarket?.slug ?? dmaSlug,
          region: catalogMarket?.region,
        };
      }
    }
    const regionStyle = resolveMcpRegionPathStyle({ regionLayer });
    const regionOverlays = regionGeometry
      ? polygonOverlay(provider, regionGeometry, 0, regionStyle)
      : undefined;
    const overlays =
      regionOverlays ??
      (frameRegion ? undefined : markerOverlay(provider, resolved.lat, resolved.lng));

    const snapshot = await renderBusinessMap({
      provider,
      lat: resolved.lat,
      lng: resolved.lng,
      bounds,
      label,
      zoom,
      overlays,
      fetchImage: true,
      includeHostUrl: raw.interactive !== false,
      hostBaseUrl,
      theme: resolveMcpMapTheme(raw.theme),
      regionLayer,
    });

    if (
      regionLayer?.dataset === 'dma' &&
      'mode' in regionLayer &&
      regionLayer.mode === 'viewport'
    ) {
      snapshot.summary =
        'Continental US overview — open the interactive map for all Nielsen DMA colors.';
    }

    return mcpMapResult(snapshot);
  });
}

export async function handleFindPlace(raw: Record<string, unknown>): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const query = readOptionalString(raw, 'place', 'query') ?? '';
    if (!query.trim()) {
      return mcpError('Provide a place name or address.');
    }

    const resolved = await geocodePlaceQuery(query);
    const text = [
      `**${resolved.label}**`,
      `Coordinates: ${resolved.lat.toFixed(5)}, ${resolved.lng.toFixed(5)}`,
    ].join('\n\n');

    return mcpSuccess(text, {
      label: resolved.label,
      lat: resolved.lat,
      lng: resolved.lng,
    });
  });
}

export async function handleWhatsHere(raw: Record<string, unknown>): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const resolved = await resolvePlaceFromRaw(raw);
    const info = await fetchReverseGeocode(resolved.lat, resolved.lng);

    if (!info) {
      return mcpError('Could not determine what area this point is in.');
    }

    const parts = [
      info.address,
      [info.neighborhood, info.city].filter(Boolean).join(', '),
      [info.state, info.postcode].filter(Boolean).join(' '),
      info.country,
    ].filter(Boolean);

    const text = [
      `**What's here:** ${resolved.label}`,
      parts.length > 0 ? parts.join('\n') : 'No detailed address available.',
    ].join('\n\n');

    return mcpSuccess(text, {
      lat: resolved.lat,
      lng: resolved.lng,
      city: info.city,
      state: info.state,
      postcode: info.postcode,
      country: info.country,
      address: info.address,
    });
  });
}

export async function handleHowFar(raw: Record<string, unknown>): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const fromQuery = readOptionalString(raw, 'from') ?? '';
    const toQuery = readOptionalString(raw, 'to') ?? '';
    if (!fromQuery.trim() || !toQuery.trim()) {
      return mcpError('Provide both "from" and "to" places or addresses.');
    }

    const [from, to] = await Promise.all([
      geocodePlaceQuery(fromQuery),
      geocodePlaceQuery(toQuery),
    ]);
    const straightMeters = haversineMeters([from.lat, from.lng])([to.lat, to.lng]);
    const mode = raw.mode === 'walking' || raw.mode === 'cycling' ? raw.mode : ('driving' as const);

    const route = await fetchDirections({
      fromLat: from.lat,
      fromLng: from.lng,
      toLat: to.lat,
      toLng: to.lng,
      mode,
    });

    const lines = [
      `**From:** ${from.label}`,
      `**To:** ${to.label}`,
      formatStraightLineDistance(straightMeters),
    ];

    if (route) {
      lines.push(
        `By ${mode}: ${metersToMiles(route.distanceMeters)} (${formatDriveTime(route.durationSeconds)}).`
      );
    }

    return mcpSuccess(lines.join('\n\n'), {
      from,
      to,
      straightLineMeters: straightMeters,
      driveDistanceMeters: route?.distanceMeters,
      driveDurationSeconds: route?.durationSeconds,
    });
  });
}

export async function handleNearby(raw: Record<string, unknown>): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const resolved = await resolvePlaceFromRaw(raw);
    const query = readOptionalString(raw, 'query', 'type') ?? '';
    if (!query.trim()) {
      return mcpError('Provide what to search for (e.g. query: "coffee" or type: "hospitals").');
    }

    const radiusMiles = readOptionalNumber(raw, 'radiusMiles') ?? 2;
    const limit = readOptionalNumber(raw, 'limit') ?? 10;

    const results = await fetchNearbyPlaces({
      lat: resolved.lat,
      lng: resolved.lng,
      query,
      radiusMeters: milesToMeters(radiusMiles),
      limit,
    });

    if (results.length === 0) {
      return mcpSuccess(
        `No results for "${query}" within ${radiusMiles} miles of ${resolved.label}.`
      );
    }

    const rows: NearbyPlaceRow[] = results.map((item) => ({
      name: item.name,
      distanceMiles: item.distance ? item.distance / 1609.344 : 0,
      address: item.address,
      rating: item.rating,
    }));

    const table = markdownTable(
      ['Place', 'Distance', 'Address'],
      rows.map((row) => [
        row.name,
        row.distanceMiles ? `${row.distanceMiles.toFixed(1)} mi` : '—',
        row.address ?? '—',
      ])
    );

    const text = [
      `**Near ${resolved.label}** — "${query}" within ${radiusMiles} miles`,
      table,
    ].join('\n\n');

    return mcpSuccess(text, { center: resolved, results: rows });
  });
}

export async function handleDriveTimeArea(
  raw: Record<string, unknown>,
  provider: ResolvedMapStaticProvider,
  hostBaseUrl: string
): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const resolved = await resolvePlaceFromRaw(raw);
    const minutes = readOptionalNumber(raw, 'minutes') ?? 15;
    const mode =
      raw.mode === 'walking' || raw.mode === 'cycling' || raw.mode === 'driving-traffic'
        ? raw.mode
        : 'driving';

    const isochrones = await fetchIsochrone({
      lat: resolved.lat,
      lng: resolved.lng,
      minutes,
      mode,
    });

    const feature = isochrones.features?.[0];
    if (!feature?.geometry) {
      return mcpError('Could not build a drive-time area for this location.');
    }

    const overlays = [
      ...polygonOverlay(provider, feature.geometry, 0),
      ...markerOverlay(provider, resolved.lat, resolved.lng, 0),
    ];

    const snapshot = await renderBusinessMap({
      provider,
      lat: resolved.lat,
      lng: resolved.lng,
      label: `${minutes}-minute ${mode} area — ${resolved.label}`,
      overlays,
      fetchImage: true,
      includeHostUrl: true,
      hostBaseUrl,
      theme: resolveMcpMapTheme(raw.theme),
    });

    const summary = `**${minutes}-minute ${mode} reach** from ${resolved.label}.`;
    snapshot.summary = summary;
    snapshot.markdown = [summary, snapshot.markdown].join('\n\n');

    return mcpMapResult(snapshot);
  });
}

export async function handleDrawRadius(
  raw: Record<string, unknown>,
  provider: ResolvedMapStaticProvider,
  hostBaseUrl: string
): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const resolved = await resolvePlaceFromRaw(raw);
    const radiusKm = readOptionalNumber(raw, 'radiusKm');
    const radiusMiles =
      readOptionalNumber(raw, 'radiusMiles') ?? (radiusKm != null ? radiusKm / 1.60934 : 5);

    const radiusMeters = milesToMeters(radiusMiles);
    const areaSqMiles = circleAreaSqMiles(radiusMeters);

    const overlays = [
      ...circleOverlay(provider, resolved.lat, resolved.lng, radiusMeters),
      ...markerOverlay(provider, resolved.lat, resolved.lng),
    ];

    const snapshot = await renderBusinessMap({
      provider,
      lat: resolved.lat,
      lng: resolved.lng,
      label: `${radiusMiles} mi radius — ${resolved.label}`,
      overlays,
      fetchImage: true,
      includeHostUrl: true,
      hostBaseUrl,
      theme: resolveMcpMapTheme(raw.theme),
    });

    const summary = `**${radiusMiles}-mile radius** around ${resolved.label} covers about ${formatAreaSqMiles(areaSqMiles)}.`;
    snapshot.summary = summary;
    snapshot.markdown = [summary, snapshot.markdown].join('\n\n');

    return mcpMapResult(snapshot);
  });
}

export async function handleCompareAreas(
  raw: Record<string, unknown>,
  provider: ResolvedMapStaticProvider,
  hostBaseUrl: string
): Promise<CallToolResult> {
  return runMcpTool(async () => {
    const placesRaw = raw.places;
    if (!Array.isArray(placesRaw) || placesRaw.length < 2 || placesRaw.length > 4) {
      return mcpError('Provide 2 to 4 place names in the "places" array.');
    }

    const queries = placesRaw.filter(
      (p): p is string => typeof p === 'string' && p.trim().length > 0
    );
    if (queries.length < 2) {
      return mcpError('Each entry in "places" must be a non-empty address or place name.');
    }

    const resolved = await Promise.all(queries.map((q) => geocodePlaceQuery(q)));
    const minutes = readOptionalNumber(raw, 'minutes');
    const radiusMiles = readOptionalNumber(raw, 'radiusMiles');

    const rows: AreaComparisonRow[] = [];
    const overlays: string[] = [];

    for (let i = 0; i < resolved.length; i++) {
      const place = resolved[i];
      const row: AreaComparisonRow = {
        label: place.label,
        lat: place.lat,
        lng: place.lng,
      };

      overlays.push(...markerOverlay(provider, place.lat, place.lng, i));

      if (radiusMiles) {
        const radiusMeters = milesToMeters(radiusMiles);
        row.radiusMiles = radiusMiles;
        row.areaSqMiles = circleAreaSqMiles(radiusMeters);
        overlays.push(...circleOverlay(provider, place.lat, place.lng, radiusMeters, i));
      }

      if (minutes) {
        try {
          const isochrones = await fetchIsochrone({
            lat: place.lat,
            lng: place.lng,
            minutes,
            mode: 'driving',
          });
          const geometry = isochrones.features?.[0]?.geometry;
          if (geometry) {
            overlays.push(...polygonOverlay(provider, geometry, i));
            row.driveMinutes = minutes;
          }
        } catch {
          // isochrone optional per site
        }
      }

      rows.push(row);
    }

    const center = resolved[0];
    const snapshot = await renderBusinessMap({
      provider,
      lat: center.lat,
      lng: center.lng,
      label: 'Area comparison',
      overlays,
      fetchImage: true,
      includeHostUrl: true,
      hostBaseUrl,
      theme: resolveMcpMapTheme(raw.theme),
    });

    const table = markdownTable(
      ['Location', radiusMiles ? 'Radius area' : '—', minutes ? `${minutes} min drive` : '—'],
      rows.map((row) => [
        row.label,
        row.areaSqMiles ? formatAreaSqMiles(row.areaSqMiles) : '—',
        row.driveMinutes ? `${row.driveMinutes} min reach` : '—',
      ])
    );

    const distanceLines: string[] = [];
    for (let i = 1; i < resolved.length; i++) {
      const meters = haversineMeters([resolved[0].lat, resolved[0].lng])([
        resolved[i].lat,
        resolved[i].lng,
      ]);
      distanceLines.push(`${resolved[0].label} → ${resolved[i].label}: ${metersToMiles(meters)}`);
    }

    const text = [
      '**Comparing locations**',
      table,
      distanceLines.length > 0 ? distanceLines.join('\n') : undefined,
      snapshot.markdown,
    ]
      .filter(Boolean)
      .join('\n\n');

    const content: CallToolResult['content'] = [{ type: 'text', text }];
    if (snapshot.imageBase64) {
      content.push({
        type: 'image',
        data: snapshot.imageBase64,
        mimeType: snapshot.mimeType ?? 'image/png',
      });
    }

    return {
      content,
      structuredContent: { places: rows, imageUrl: snapshot.imageUrl },
    };
  });
}
