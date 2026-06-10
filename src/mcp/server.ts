#!/usr/bin/env node
/**
 * Geokit MCP server — business-friendly map tools for Cursor chat.
 */

import dotenv from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  compareAreasSchema,
  drawRadiusSchema,
  driveTimeAreaSchema,
  findPlaceSchema,
  howFarSchema,
  nearbySchema,
  showMapSchema,
  whatsHereSchema,
} from './business/schemas.js';
import {
  handleCompareAreas,
  handleDrawRadius,
  handleDriveTimeArea,
  handleFindPlace,
  handleHowFar,
  handleNearby,
  handleShowMap,
  handleWhatsHere,
} from './business/tools.js';
import { buildMapHostUrl, resolveMapHostBaseUrl } from './open-map.js';
import { renderMapViewForMcp } from './render-map-view.js';
import { resolveMapViewInput } from './resolve-map-input.js';
import {
  assertMapStaticProviderConfigured,
  resolveMapStaticProvider,
} from './resolve-map-provider.js';
import { ensureGlobeCdnJwt } from './resolve-globe-cdn-auth.js';
import type { MapViewInput } from '../types/mcp-map.js';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
dotenv.config({ path: join(packageRoot, '.env') });

const mapProvider = resolveMapStaticProvider();
const mapHostUrl = resolveMapHostBaseUrl();
const globeCdnBaseUrl =
  process.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
  process.env.GLOBE_CDN_URL?.trim() ||
  process.env.FW_GLOBE_CDN_URL?.trim() ||
  undefined;

const mapInputSchema = {
  lat: z.number().optional().describe('Center latitude'),
  lng: z.number().optional().describe('Center longitude'),
  zoom: z.number().min(0).max(22).optional().describe('Zoom level (default 12, or from bounds)'),
  bounds: z
    .tuple([z.number(), z.number(), z.number(), z.number()])
    .optional()
    .describe('Bounding box [minLon, minLat, maxLon, maxLat]'),
  countyFips: z
    .string()
    .optional()
    .describe('US county FIPS (e.g. 36047 for Kings / Brooklyn) — frames map from CDN polygon'),
  state: z
    .string()
    .optional()
    .describe('US state code (with place) — frames map from CDN place polygon'),
  place: z
    .string()
    .optional()
    .describe('Place slug from CDN state catalog (e.g. new-york, brooklyn via borough alias)'),
  style: z.string().optional().describe('Map style id (provider-specific default when omitted)'),
  width: z.number().min(1).max(2048).optional().describe('Snapshot width in pixels (default 600)'),
  height: z
    .number()
    .min(1)
    .max(2048)
    .optional()
    .describe('Snapshot height in pixels (default 400)'),
  label: z.string().optional().describe('Optional map label for markdown alt text'),
  theme: z.enum(['light', 'dark']).optional().describe('Theme for interactive host URL'),
};

function mapInputFromRaw(raw: Record<string, unknown>): MapViewInput {
  return {
    lat: typeof raw.lat === 'number' ? raw.lat : undefined,
    lng: typeof raw.lng === 'number' ? raw.lng : undefined,
    zoom: typeof raw.zoom === 'number' ? raw.zoom : undefined,
    bounds:
      Array.isArray(raw.bounds) && raw.bounds.length === 4
        ? (raw.bounds as [number, number, number, number])
        : undefined,
    countyFips: typeof raw.countyFips === 'string' ? raw.countyFips : undefined,
    state: typeof raw.state === 'string' ? raw.state : undefined,
    place: typeof raw.place === 'string' ? raw.place : undefined,
    style: typeof raw.style === 'string' ? raw.style : undefined,
    width: typeof raw.width === 'number' ? raw.width : undefined,
    height: typeof raw.height === 'number' ? raw.height : undefined,
    label: typeof raw.label === 'string' ? raw.label : undefined,
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : undefined,
  };
}

async function resolveInput(raw: Record<string, unknown>): Promise<MapViewInput> {
  return resolveMapViewInput(mapInputFromRaw(raw), { cdnBaseUrl: globeCdnBaseUrl });
}

function mcpError(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

async function main(): Promise<void> {
  await ensureGlobeCdnJwt();

  const mcp = new McpServer(
    { name: 'geokit', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'Business-friendly geokit map tools. **show_map** renders a map image. **find_place** / **whats_here** resolve locations. **how_far**, **nearby**, **drive_time_area**, **draw_radius**, and **compare_areas** answer common reach and distance questions. Legacy **render_map** / **open_map** remain for GIS-style inputs. Requires GEOKIT_MAP_API_KEY for map images; routing token for drive times; FOURSQUARE_API_KEY for nearby. DMA outlines need GLOBE_CDN_JWT when the CDN requires auth.',
    }
  );

  type ToolSchema = Record<string, z.ZodTypeAny>;

  const registerTool = (
    mcp as unknown as {
      registerTool: (
        name: string,
        config: { description: string; inputSchema: ToolSchema },
        handler: (raw: Record<string, unknown>) => Promise<CallToolResult>
      ) => void;
    }
  ).registerTool.bind(mcp);

  const businessMapHandler =
    (handler: typeof handleShowMap) =>
    async (raw: Record<string, unknown>): Promise<CallToolResult> => {
      try {
        const provider = assertMapStaticProviderConfigured(mapProvider);
        return handler(raw, provider, mapHostUrl, { cdnBaseUrl: globeCdnBaseUrl });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return mcpError(message);
      }
    };

  registerTool(
    'render_map',
    {
      description:
        'Render a static map snapshot for inline chat display. Returns markdown + PNG image content. Provide lat/lng, bounds, countyFips, or state+place.',
      inputSchema: mapInputSchema,
    },
    async (raw): Promise<CallToolResult> => {
      try {
        const provider = assertMapStaticProviderConfigured(mapProvider);
        const input = await resolveInput(raw);
        const result = await renderMapViewForMcp(input, {
          provider,
          fetchImage: true,
          cdnBaseUrl: globeCdnBaseUrl,
        });

        const content: CallToolResult['content'] = [{ type: 'text', text: result.markdown }];

        if (result.imageBase64) {
          content.push({
            type: 'image',
            data: result.imageBase64,
            mimeType: result.mimeType ?? 'image/png',
          });
        }

        return {
          content,
          structuredContent: {
            viewport: result.viewport,
            style: result.style,
            provider: result.provider,
            width: result.width,
            height: result.height,
            imageUrl: result.imageUrl,
            bounds: input.bounds,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return mcpError(`render_map failed: ${message}`);
      }
    }
  );

  registerTool(
    'show_map',
    {
      description:
        'Show a location on a map. Provide a place name, address, or lat/lng. Returns a plain-language summary, map image, and optional interactive link.',
      inputSchema: showMapSchema,
    },
    businessMapHandler(handleShowMap)
  );

  registerTool(
    'find_place',
    {
      description: 'Find where a place or address is. Returns a readable label and coordinates.',
      inputSchema: findPlaceSchema,
    },
    handleFindPlace
  );

  registerTool(
    'whats_here',
    {
      description:
        'Describe what area a point is in — city, state, ZIP, and street address when available.',
      inputSchema: whatsHereSchema,
    },
    handleWhatsHere
  );

  registerTool(
    'how_far',
    {
      description:
        'How far apart are two places? Returns straight-line distance and drive time when routing is configured.',
      inputSchema: howFarSchema,
    },
    handleHowFar
  );

  registerTool(
    'nearby',
    {
      description:
        'Find places near a location (e.g. coffee shops, hospitals). Requires FOURSQUARE_API_KEY.',
      inputSchema: nearbySchema,
    },
    handleNearby
  );

  registerTool(
    'drive_time_area',
    {
      description:
        'Show who can reach a location within X minutes by car, walking, or cycling. Requires a configured routing API token.',
      inputSchema: driveTimeAreaSchema,
    },
    businessMapHandler(handleDriveTimeArea)
  );

  registerTool(
    'draw_radius',
    {
      description:
        'Draw a simple radius circle around a location (e.g. 5 miles) and report the area size.',
      inputSchema: drawRadiusSchema,
    },
    businessMapHandler(handleDrawRadius)
  );

  registerTool(
    'compare_areas',
    {
      description:
        'Compare 2–4 candidate locations side by side with optional equal radii or drive-time areas.',
      inputSchema: compareAreasSchema,
    },
    businessMapHandler(handleCompareAreas)
  );

  registerTool(
    'open_map',
    {
      description:
        'Build map config plus an interactive map host URL. Use when the user needs pan/zoom after a snapshot.',
      inputSchema: mapInputSchema,
    },
    async (raw): Promise<CallToolResult> => {
      try {
        const provider = assertMapStaticProviderConfigured(mapProvider);
        const input = await resolveInput(raw);
        const snapshot = await renderMapViewForMcp(input, {
          provider,
          fetchImage: false,
          cdnBaseUrl: globeCdnBaseUrl,
        });
        const hostUrl = buildMapHostUrl({
          hostBaseUrl: mapHostUrl,
          viewport: snapshot.viewport,
          style: snapshot.style,
          theme: input.theme,
          provider: snapshot.provider,
        });

        const markdown = [
          input.label ? `### ${input.label}` : undefined,
          `**Interactive map:** ${hostUrl}`,
          `Center: ${snapshot.viewport.lat.toFixed(5)}, ${snapshot.viewport.lng.toFixed(5)} · zoom ${snapshot.viewport.zoom}`,
        ]
          .filter(Boolean)
          .join('\n\n');

        return {
          content: [{ type: 'text', text: markdown }],
          structuredContent: {
            viewport: snapshot.viewport,
            style: snapshot.style,
            provider: snapshot.provider,
            hostUrl,
            imageUrl: snapshot.imageUrl,
            bounds: input.bounds,
          },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return mcpError(`open_map failed: ${message}`);
      }
    }
  );

  const transport = new StdioServerTransport();
  await mcp.connect(transport);

  console.error(
    '[geokit] stdio server ready — business tools: show_map, find_place, whats_here, how_far, nearby, drive_time_area, draw_radius, compare_areas (+ render_map, open_map). Waiting for MCP client on stdin (Ctrl+C to stop).'
  );
  if (!mapProvider.apiKey) {
    console.error(
      '[geokit] WARNING: map API key is not set (GEOKIT_MAP_API_KEY / MAP_API_KEY); map tools will error until configured.'
    );
  }
  if (!process.env.GLOBE_CDN_JWT?.trim() && !process.env.GEOKIT_GLOBE_CDN_JWT?.trim()) {
    console.error(
      '[geokit] WARNING: Globe CDN DMA JWT missing — set GLOBE_CDN_JWT_SECRET in packages/geokit/.env for DMA outlines.'
    );
  } else {
    console.error('[geokit] Globe CDN DMA auth configured.');
  }
}

main().catch((error) => {
  console.error('[geokit]', error);
  process.exit(1);
});
