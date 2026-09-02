import { FORM_FIELDS_JSON_KEYS, FormFieldsSchema } from './schemas/form-fields.schema';
import type * as Y from 'yjs';
import { TypedMetaMap } from './TypedMetaMap';

const FORM_FIELDS_MAP_NAME = 'form-fields';

/**
 * Create a type-safe wrapper for the form-fields Y.Map.
 */
export function createFormFieldsMap(doc: Y.Doc): TypedMetaMap<typeof FormFieldsSchema> {
  return new TypedMetaMap(doc.getMap(FORM_FIELDS_MAP_NAME), FormFieldsSchema, FORM_FIELDS_JSON_KEYS);
}

// Re-export types and schema
export { FormFieldsSchema, DEFAULT_FORM_FIELDS, type FormFields } from './schemas/form-fields.schema';
