import type * as Y from 'yjs';
import { PROGRAM_EVENT_META_JSON_KEYS, ProgramEventMetaSchema } from './schemas/program-event-meta.schema';
import { TypedMetaMap } from './TypedMetaMap';

const PROGRAM_EVENT_META_MAP_NAME = 'program-event-meta';

export function createProgramEventMetaMap(doc: Y.Doc): TypedMetaMap<typeof ProgramEventMetaSchema> {
  return new TypedMetaMap(
    doc.getMap(PROGRAM_EVENT_META_MAP_NAME),
    ProgramEventMetaSchema,
    PROGRAM_EVENT_META_JSON_KEYS,
  );
}

export {
  DEFAULT_PROGRAM_EVENT_META,
  type ProgramEventMeta,
  type ProgramEventPosterMedia,
} from './schemas/program-event-meta.schema';
