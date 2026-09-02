import type * as Y from 'yjs';
import { POST_TRANSIENT_META_JSON_KEYS, PostTransientMetaSchema } from './schemas/post-meta.schema';
import { TypedMetaMap } from './TypedMetaMap';

const POST_META_MAP_NAME = 'post-meta';
const TRANSIENT_POST_META_KEYS = new Set(['categoryIds', 'tagIds']);

export function removeLegacyPostMetaFields(doc: Y.Doc): void {
  const map = doc.getMap(POST_META_MAP_NAME);
  const keysToDelete = [...map.keys()].filter((key) => !TRANSIENT_POST_META_KEYS.has(key));
  if (keysToDelete.length === 0) {
    return;
  }
  doc.transact(() => {
    keysToDelete.forEach((key) => map.delete(key));
  });
}

/**
 * Create a type-safe wrapper for the post-meta Y.Map.
 */
export function createPostMetaMap(doc: Y.Doc): TypedMetaMap<typeof PostTransientMetaSchema> {
  return new TypedMetaMap(doc.getMap(POST_META_MAP_NAME), PostTransientMetaSchema, POST_TRANSIENT_META_JSON_KEYS);
}

// Re-export types and schema
export { DEFAULT_POST_META, type PostMeta, type Category, type Tag } from './schemas/post-meta.schema';
