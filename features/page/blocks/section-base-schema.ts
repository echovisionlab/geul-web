import { z } from 'zod';

export const sectionSettingsSchema = z.object({
  backgroundColor: z.string().default(''),
  paddingTop: z.string().default('0'),
  paddingBottom: z.string().default('0'),
  paddingLeft: z.string().default('0'),
  paddingRight: z.string().default('0'),
  maxWidth: z.enum(['full', 'container', 'narrow']).default('full'),
});

export const sectionBaseSchema = z.object({
  id: z.string(),
  settings: sectionSettingsSchema.optional(),
});

export function createPageBlockSectionSchema<TType extends string, TSchema extends z.ZodObject>(
  type: TType,
  schema: TSchema,
) {
  return sectionBaseSchema.extend({
    type: z.literal(type),
    props: schema.partial().optional(),
  });
}
