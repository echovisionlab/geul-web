import type { EmbedProps as SharedEmbedProps } from '@echovisionlab/geul-common/page';
import { z } from 'zod';
import { booleanString } from '../list-shared';

export const EMBED_MIN_HEIGHT = 180;
export const EMBED_MAX_HEIGHT = 2160;
export const EMBED_DEFAULT_HEIGHT = 640;

export const embedSchema = z.object({
  uri: z.string().default(''),
  title: z.string().default(''),
  heightMode: z.enum(['fixed', 'auto', 'viewport']).default('fixed'),
  height: z
    .string()
    .refine((value) => /^\d+$/.test(value) && Number(value) >= EMBED_MIN_HEIGHT && Number(value) <= EMBED_MAX_HEIGHT)
    .default(String(EMBED_DEFAULT_HEIGHT)),
  allowScripts: booleanString.default('true'),
  allowSameOrigin: booleanString.default('true'),
  allowForms: booleanString.default('false'),
  allowDownloads: booleanString.default('false'),
  allowPopups: booleanString.default('false'),
  allowMicrophone: booleanString.default('false'),
  allowSpeakerSelection: booleanString.default('false'),
  allowFullscreen: booleanString.default('false'),
}) satisfies z.ZodType<SharedEmbedProps>;

export type EmbedProps = z.infer<typeof embedSchema>;

export function parseEmbedProps(value: unknown): EmbedProps {
  return embedSchema.parse(value ?? {});
}
