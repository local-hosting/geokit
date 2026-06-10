#!/usr/bin/env node
/**
 * Geokit MCP server — static map snapshots for Cursor chat + optional interactive host URL.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { buildMapHostUrl, resolveMapHostBaseUrl } from './open-map.js';
import { renderMapViewForMcp } from './render-map-view.js';
import { resolveMapViewInput } from './resolve-map-input.js';
import type { MapViewInput } from '../types/mcp-map.js';

const maptilerKey =
  process.env.MAPTILER_KEY?.trim() || process.env.GEOKIT_MAPTILER_KEY?.trim() || '';
const mapHostUrl = resolveMapHostBaseUrl();
const globeCdnBaseUrl =
  process.env.GEOKIT_GLOBE_CDN_URL?.trim() ||
  process.env.GLOBE_CDN_URL?.trim() ||
  process.env.FW_GLOBE_CDN_URL?.trim() ||
  undefined;

function resolveMaptilerReferer(): string | undefined {
  const explicit =
    process.env.MAPTILER_REFERER?.trim() || process.env.GEOKIT_MAPTILER_REFERER?.trim();
  if (explicit) return explicit;
  try {
    return `${new URL(mapHostUrl).origin}/`;
  } catch {
    return undefined;
  }
}

const maptilerReferer = resolveMaptilerReferer();

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
  style: z.string().optional().describe('MapTiler style id (default dataviz-dark)'),
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
  const mcp = new McpServer(
    { name: 'geokit', version: '0.1.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'geokit map tools for Cursor chat. **render_map** returns a static MapTiler PNG (inline in chat). **open_map** adds an interactive map host URL (run `yarn map-host` in @twinfile/geokit). Provide lat/lng, bounds, countyFips, or state+place (CDN polygon). Requires MAPTILER_KEY.',
    }
  );

  const registerTool = (
    mcp as unknown as {
      registerTool: (
        name: string,
        config: { description: string; inputSchema: typeof mapInputSchema },
        handler: (raw: Record<string, unknown>) => Promise<CallToolResult>
      ) => void;
    }
  ).registerTool.bind(mcp);

  registerTool(
    'render_map',
    {
      description:
        'Render a static map snapshot for inline chat display. Returns markdown + PNG image content. Provide lat/lng, bounds, countyFips, or state+place.',
      inputSchema: mapInputSchema,
    },
    async (raw): Promise<CallToolResult> => {
      if (!maptilerKey) {
        return mcpError(
          'MAPTILER_KEY (or GEOKIT_MAPTILER_KEY) is not set for the geokit MCP server.'
        );
      }

      try {
        const input = await resolveInput(raw);
        const result = await renderMapViewForMcp(input, {
          maptilerKey,
          fetchImage: true,
          referer: maptilerReferer,
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
    'open_map',
    {
      description:
        'Build map config plus an interactive map host URL. Use when the user needs pan/zoom after a snapshot.',
      inputSchema: mapInputSchema,
    },
    async (raw): Promise<CallToolResult> => {
      if (!maptilerKey) {
        return mcpError(
          'MAPTILER_KEY (or GEOKIT_MAPTILER_KEY) is not set for the geokit MCP server.'
        );
      }

      try {
        const input = await resolveInput(raw);
        const snapshot = await renderMapViewForMcp(input, {
          maptilerKey,
          fetchImage: false,
          cdnBaseUrl: globeCdnBaseUrl,
        });
        const hostUrl = buildMapHostUrl({
          hostBaseUrl: mapHostUrl,
          viewport: snapshot.viewport,
          style: snapshot.style,
          theme: input.theme,
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
    '[geokit] stdio server ready — tools: render_map, open_map. Waiting for MCP client on stdin (Ctrl+C to stop).'
  );
  if (!maptilerKey) {
    console.error(
      '[geokit] WARNING: MAPTILER_KEY (or GEOKIT_MAPTILER_KEY) is not set; map tools will error until configured.'
    );
  }
}

main().catch((error) => {
  console.error('[geokit]', error);
  process.exit(1);
});
