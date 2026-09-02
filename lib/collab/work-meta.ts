import type * as Y from 'yjs';
import { WORK_META_JSON_KEYS, WorkMetaSchema } from './schemas/work-meta.schema';
import { TypedMetaMap } from './TypedMetaMap';

const WORK_META_MAP_NAME = 'work-meta';
const LEGACY_WORK_META_KEYS = ['featuredImageUrl', 'status'] as const;

export function removeLegacyWorkMetaFields(doc: Y.Doc): void {
  const map = doc.getMap(WORK_META_MAP_NAME);
  const keysToDelete = LEGACY_WORK_META_KEYS.filter((key) => map.has(key));
  if (keysToDelete.length === 0) {
    return;
  }
  doc.transact(() => {
    keysToDelete.forEach((key) => map.delete(key));
  });
}

/**
 * Create a type-safe wrapper for the work-meta Y.Map.
 */
export function createWorkMetaMap(doc: Y.Doc): TypedMetaMap<typeof WorkMetaSchema> {
  return new TypedMetaMap(doc.getMap(WORK_META_MAP_NAME), WorkMetaSchema, WORK_META_JSON_KEYS);
}

// Re-export types and schema
export { DEFAULT_WORK_META, type WorkMeta, type WorkType, type CreditOrderItem } from './schemas/work-meta.schema';
