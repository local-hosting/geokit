/**
 * Geokit Debug Logger
 *
 * Prefer {@link createGeokitLogger} with a scope so messages use `[gk-<scope>]`.
 */

import { createGeokitLogger, createLogger, geokitTag } from '@geokit/core';

const logger = createLogger({ windowFlag: '__GEOKIT_DEBUG__' });

export const { debug, setDebugEnabled, isDebugEnabled } = logger;
export { createGeokitLogger, geokitTag };
