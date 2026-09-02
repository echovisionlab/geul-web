/**
 * Proto type utilities for client-side usage.
 *
 * Server Actions return Proto types directly (Timestamp, enums, etc.).
 * Use these utilities in client components to convert them for display.
 */

import { timestampDate, type Timestamp } from '@bufbuild/protobuf/wkt';

/**
 * Convert Proto Timestamp to JavaScript Date.
 * Returns undefined if timestamp is undefined.
 */
export function toDate(ts: Timestamp | undefined): Date | undefined {
  return ts ? timestampDate(ts) : undefined;
}
