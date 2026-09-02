import {
  METADATA_AI_JSON_KEYS,
  METADATA_AI_MAP_NAME,
  metadataAiSharedStateSchema,
} from '@echovisionlab/geul-common/collaboration/metadata-ai';
import type * as Y from 'yjs';
import { TypedMetaMap } from './TypedMetaMap';

export function createMetadataAiMap(doc: Y.Doc) {
  return new TypedMetaMap(doc.getMap(METADATA_AI_MAP_NAME), metadataAiSharedStateSchema, METADATA_AI_JSON_KEYS);
}

export {
  DEFAULT_METADATA_AI_SHARED_STATE,
  METADATA_AI_GRACE_PERIOD_MS,
  type MetadataAiField,
  type MetadataAiSharedState,
} from '@echovisionlab/geul-common/collaboration/metadata-ai';
