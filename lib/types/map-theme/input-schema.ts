import 'server-only';
import { z } from 'zod';
import * as zm from '@/lib/zod-mini';
import {
  MapThemeDocumentMetaSchema,
  MapThemeDocumentSettingsSchema,
  MapThemeDocumentVariantSchema,
} from '@echovisionlab/geul-common/collaboration/map-theme';

/**
 * Create theme input schema, used by the create-theme server action. It extends the Common
 * snapshot schemas, so it is kept out of `./schema`, which client components
 * import for the theme defaults.
 */
export const createMapThemeInputSchema = z
  .object({
    name: MapThemeDocumentMetaSchema.shape.name,
    settings: MapThemeDocumentSettingsSchema,
    // The Common variant is a strict zod/mini object; extending keeps it strict.
    lightVariant: zm.extend(MapThemeDocumentVariantSchema, { scheme: zm.literal('light') }),
    darkVariant: zm.extend(MapThemeDocumentVariantSchema, { scheme: zm.literal('dark') }),
  })
  .strict();
