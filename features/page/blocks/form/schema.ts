import { z } from 'zod';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Form block props schema.
 */
export const formSchema = z.object({
  formId: z.string().default(''),
  showTitle: booleanString.default('true'),
});

export type FormProps = z.infer<typeof formSchema>;

/**
 * Parse and validate form props with defaults applied.
 */
export function parseFormProps(data: unknown): FormProps {
  return formSchema.parse(data ?? {});
}
