import { z } from 'zod';
import { formSchemaZod } from '@/lib/types/form/schema';

// =============================================================================
// Form Fields Schema (fixed fields for TypedMetaMap)
// =============================================================================

export const FormFieldsSchema = z.object({
  // Editor fields
  title: z.string(),
  schema: formSchemaZod,
});

export type FormFields = z.infer<typeof FormFieldsSchema>;

export const DEFAULT_FORM_FIELDS: FormFields = {
  // Editor defaults
  title: '',
  schema: { id: '', steps: [] },
};

export const FORM_FIELDS_JSON_KEYS: ReadonlySet<keyof FormFields> = new Set(['schema']);
