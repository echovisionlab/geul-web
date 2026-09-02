import type { FormFieldSchema } from '@/lib/types/form/schema';
import { defaultFormValidationMessages, type FormValidationMessages } from './validation-messages';

export function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim() === '';
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

export function hasRequired(field: FormFieldSchema): boolean {
  return field.validation?.validators?.some((validator) => validator.predicate === 'required') ?? false;
}

export function getRequiredMessage(
  field: FormFieldSchema,
  messages: FormValidationMessages = defaultFormValidationMessages,
): string {
  const requiredValidator = field.validation?.validators?.find((validator) => validator.predicate === 'required');
  return requiredValidator?.message ?? messages.required;
}
