import type { FormFieldSchema } from '@/lib/types/form/schema';

interface FieldLimits {
  min?: number;
  max?: number;
}

/**
 * Extract min/max length limits from field validators.
 * For string fields, 'gte' = min length, 'lte' = max length.
 */
export function getFieldLimits(field: FormFieldSchema): FieldLimits {
  const validators = field.validation?.validators ?? [];

  let min: number | undefined;
  let max: number | undefined;

  for (const v of validators) {
    if (v.predicate === 'gte' && typeof v.value === 'number') {
      min = v.value;
    } else if (v.predicate === 'lte' && typeof v.value === 'number') {
      max = v.value;
    }
  }

  return { min, max };
}

export function getFieldLabel(field: FormFieldSchema): string {
  return field.label?.trim() || getFieldKey(field);
}

export function getFieldKey(field: FormFieldSchema): string {
  return field.key?.trim() || field.name?.trim() || field.id;
}
