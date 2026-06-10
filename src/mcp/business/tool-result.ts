/**
 * MCP business tool result helpers — DRY error wrapping and arg parsing.
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function mcpError(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
  };
}

export function mcpSuccess(text: string, structured?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    structuredContent: structured,
  };
}

export async function runMcpTool(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  try {
    return await fn();
  } catch (error) {
    return mcpError(error instanceof Error ? error.message : String(error));
  }
}

export function readOptionalString(
  raw: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
}

export function readOptionalNumber(raw: Record<string, unknown>, key: string): number | undefined {
  const value = raw[key];
  return typeof value === 'number' ? value : undefined;
}

export function placeInputFromRaw(raw: Record<string, unknown>): {
  place?: string;
  lat?: number;
  lng?: number;
} {
  return {
    place: readOptionalString(raw, 'place'),
    lat: readOptionalNumber(raw, 'lat'),
    lng: readOptionalNumber(raw, 'lng'),
  };
}
