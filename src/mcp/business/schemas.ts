import { z } from 'zod';

export const placeInputFields = {
  place: z
    .string()
    .optional()
    .describe('Place name or street address (e.g. "Austin TX", "123 Main St")'),
  lat: z.number().optional().describe('Latitude (use with lng instead of place)'),
  lng: z.number().optional().describe('Longitude (use with lat instead of place)'),
};

export const showMapSchema = {
  ...placeInputFields,
  query: z.string().optional().describe('Alias for place'),
  label: z.string().optional().describe('Optional map title'),
  zoom: z
    .number()
    .min(0)
    .max(22)
    .optional()
    .describe(
      'Zoom level for point locations (default 12). US states, counties, ZIP codes, and DMA markets draw CDN boundaries and auto-frame.'
    ),
  interactive: z.boolean().optional().describe('Include interactive map link (default true)'),
  theme: z.enum(['light', 'dark']).optional().describe('Theme for interactive map'),
};

export const findPlaceSchema = {
  place: z.string().optional().describe('Place name or address'),
  query: z.string().optional().describe('Alias for place'),
};

export const whatsHereSchema = {
  ...placeInputFields,
};

export const howFarSchema = {
  from: z.string().describe('Starting place or address'),
  to: z.string().describe('Destination place or address'),
  mode: z
    .enum(['driving', 'walking', 'cycling'])
    .optional()
    .describe('Travel mode for drive-time estimate (default driving)'),
};

export const nearbySchema = {
  ...placeInputFields,
  query: z.string().optional().describe('What to find (e.g. "coffee", "pharmacy")'),
  type: z.string().optional().describe('Alias for query'),
  radiusMiles: z
    .number()
    .min(0.1)
    .max(50)
    .optional()
    .describe('Search radius in miles (default 2)'),
  limit: z.number().min(1).max(20).optional().describe('Max results (default 10)'),
};

export const driveTimeAreaSchema = {
  ...placeInputFields,
  minutes: z.number().min(1).max(60).optional().describe('Drive/walk time in minutes (default 15)'),
  mode: z
    .enum(['driving', 'walking', 'cycling', 'driving-traffic'])
    .optional()
    .describe('Travel mode (default driving)'),
  theme: z.enum(['light', 'dark']).optional(),
};

export const drawRadiusSchema = {
  ...placeInputFields,
  radiusMiles: z.number().min(0.1).max(100).optional().describe('Radius in miles (default 5)'),
  radiusKm: z.number().min(0.1).max(160).optional().describe('Radius in km (alternative to miles)'),
  theme: z.enum(['light', 'dark']).optional(),
};

export const compareAreasSchema = {
  places: z.array(z.string()).min(2).max(4).describe('2–4 place names or addresses to compare'),
  radiusMiles: z
    .number()
    .min(0.1)
    .max(50)
    .optional()
    .describe('Optional equal-radius circles around each place'),
  minutes: z
    .number()
    .min(1)
    .max(60)
    .optional()
    .describe('Optional equal drive-time areas around each place'),
  theme: z.enum(['light', 'dark']).optional(),
};
