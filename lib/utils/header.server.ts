import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';

/**
 * Get request headers (memoized per request)
 */
export const getRequestHeaders = cache(async () => {
  return headers();
});
