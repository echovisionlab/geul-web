/**
 * Core validation functions
 */

import type { FormFieldSchema } from '@/lib/types/form/schema';
import { defaultFormValidationMessages, type FormValidationMessages } from './validation-messages';
import { buildFieldValidator } from './validation-zod';
export { getRequiredMessage, hasRequired, isEmpty } from './validation-primitives';

/**
 * Validate a value using zod schema (client/server shared)
 */
export function validateWithZod(
  field: FormFieldSchema,
  value: unknown,
  messages: FormValidationMessages = defaultFormValidationMessages,
): { success: boolean; error?: string } {
  const schema = buildFieldValidator(field, messages);
  const result = schema.safeParse(value);

  if (result.success) {
    return { success: true };
  }
  return {
    success: false,
    error: result.error.issues[0]?.message,
  };
}
