import * as z from '@/lib/zod-mini';

/**
 * Boolean stored as string for Yjs serialization compatibility.
 */
const booleanString = z.enum(['true', 'false']);

/**
 * Form block props schema.
 */
export const formSchema = z.object({
  formId: z._default(z.string(), ''),
  showTitle: z._default(booleanString, 'true'),
});

export type FormProps = z.infer<typeof formSchema>;

/**
 * Parse and validate form props with defaults applied.
 */
export function parseFormProps(data: unknown): FormProps {
  return formSchema.parse(data ?? {});
}
