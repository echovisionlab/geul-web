import * as z from '@/lib/zod-mini';

export const sectionSettingsSchema = z.object({
  backgroundColor: z._default(z.string(), ''),
  paddingTop: z._default(z.string(), '0'),
  paddingBottom: z._default(z.string(), '0'),
  paddingLeft: z._default(z.string(), '0'),
  paddingRight: z._default(z.string(), '0'),
  maxWidth: z._default(z.enum(['full', 'container', 'narrow']), 'full'),
});

export const sectionBaseSchema = z.object({
  id: z.string(),
  settings: z.optional(sectionSettingsSchema),
});

export function createPageBlockSectionSchema<TType extends string, TSchema extends z.ZodMiniObject>(
  type: TType,
  schema: TSchema,
) {
  return z.extend(sectionBaseSchema, {
    type: z.literal(type),
    // Typed against the constraint (props: Record<string, unknown>), as before the zod/mini migration.
    props: z.optional(z.partial(schema as z.ZodMiniObject)),
  });
}
