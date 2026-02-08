/**
 * Geokit Debug Logger
 *
 * Uses the shared createLogger factory with the geokit-specific window flag.
 *
 * To enable debug logging:
 * - Set window.__GEOKIT_DEBUG__ = true in the browser console
 * - Or call setDebugEnabled(true) from your code
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger({ windowFlag: '__GEOKIT_DEBUG__' });

export const { debug, setDebugEnabled, isDebugEnabled } = logger;
