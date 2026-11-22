/**
 * Map element debug logger — scope `gk-map` (tag from pino-blanc; do not put `[gk-map]` in msg).
 */

import { createGeokitLogger, geokitTag } from '@local-hosting/geokit/core';

const logger = createGeokitLogger('map');

export const { debug, setDebugEnabled, isDebugEnabled } = logger;
export { createGeokitLogger, geokitTag };
