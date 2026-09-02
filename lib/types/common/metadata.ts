import { z } from 'zod';
import { parseJsonField } from './json-parser';

/**
 * Generic metadata type for entity extensible fields.
 * Used by: Artist, Label, Release, Track
 */
export interface GenericMetadata {
  [key: string]: unknown;
}

const genericMetadataSchema = z.record(z.string(), z.unknown());

export function parseGenericMetadata(value: unknown): GenericMetadata {
  return parseJsonField(value, genericMetadataSchema, {});
}
