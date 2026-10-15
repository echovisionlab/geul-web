/**
 * The zod entry point for client-reachable code: `import * as z from '@/lib/zod-mini'`.
 *
 * Classic `zod` cannot be tree-shaken (about 90 kB gzip in every route that imports it); `zod/mini`
 * ships only the schemas a route uses. Both run the same `zod/v4/core` parser, but only classic zod
 * installs English messages by default, so this module configures them once. Server-only modules
 * may keep classic `zod`; `scripts/performance/client-zod-imports.test.ts` enforces the boundary.
 */
import { config } from 'zod/mini';
import en from 'zod/v4/locales/en.js';

config(en());

export * from 'zod/mini';
