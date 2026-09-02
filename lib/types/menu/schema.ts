import { z } from 'zod';

export const menuLinkTypeSchema = z.enum(['custom', 'page', 'category', 'tag', 'series']);
export const menuItemLocalizationModeSchema = z.enum(['translated', 'fixed_locale']);

export const menuPositionSchema = z.enum(['header', 'secondary', 'footer', 'avatar_dropdown']);
export type MenuPosition = z.infer<typeof menuPositionSchema>;

const menuVisibilityRoleSchema = z.enum(['admin', 'author', 'user']);

const menuVisibilityModeSchema = z.enum(['all', 'authenticated', 'guest', 'roles']);

const menuVisibilitySchema = z
  .object({
    mode: menuVisibilityModeSchema,
    roles: z.array(menuVisibilityRoleSchema).optional(),
  })
  .refine(
    (data) => {
      if (data.mode === 'roles') {
        return data.roles && data.roles.length > 0;
      }
      return true;
    },
    {
      message: "roles array is required when mode is 'roles'",
    },
  );

const menuItemBaseSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(50),
  linkType: menuLinkTypeSchema,
  url: z.string().max(500).optional(),
  targetId: z.string().optional(),
  targetSlug: z.string().optional(),
  openInNewTab: z.boolean().optional(),
  localizationMode: menuItemLocalizationModeSchema.optional(),
  fixedLocale: z.string().optional(),
  visibility: menuVisibilitySchema.optional(),
});

export const menuItemSchema = menuItemBaseSchema
  .extend({
    children: z.array(menuItemBaseSchema).max(10).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.localizationMode === 'fixed_locale' && !data.fixedLocale) {
      ctx.addIssue({
        code: 'custom',
        message: "fixedLocale is required when localizationMode is 'fixed_locale'",
        path: ['fixedLocale'],
      });
    }
  });

export const menuItemsSchema = z.array(menuItemSchema).max(20);
