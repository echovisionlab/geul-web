import type { EmbedProps as SharedEmbedProps } from '@echovisionlab/geul-common/page';
import * as z from '@/lib/zod-mini';
import { booleanString } from '../list-shared';

import { EMBED_DEFAULT_HEIGHT, EMBED_MAX_HEIGHT, EMBED_MIN_HEIGHT } from './limits';

export { EMBED_DEFAULT_HEIGHT, EMBED_MAX_HEIGHT, EMBED_MIN_HEIGHT };

export const embedSchema = z.object({
  uri: z._default(z.string(), ''),
  title: z._default(z.string(), ''),
  heightMode: z._default(z.enum(['fixed', 'auto', 'viewport']), 'fixed'),
  height: z._default(
    z
      .string()
      .check(
        z.refine(
          (value) => /^\d+$/.test(value) && Number(value) >= EMBED_MIN_HEIGHT && Number(value) <= EMBED_MAX_HEIGHT,
        ),
      ),
    String(EMBED_DEFAULT_HEIGHT),
  ),
  allowScripts: z._default(booleanString, 'true'),
  allowSameOrigin: z._default(booleanString, 'true'),
  allowForms: z._default(booleanString, 'false'),
  allowDownloads: z._default(booleanString, 'false'),
  allowPopups: z._default(booleanString, 'false'),
  allowMicrophone: z._default(booleanString, 'false'),
  allowSpeakerSelection: z._default(booleanString, 'false'),
  allowFullscreen: z._default(booleanString, 'false'),
}) satisfies z.ZodMiniType<SharedEmbedProps>;

export type EmbedProps = z.infer<typeof embedSchema>;

export function parseEmbedProps(value: unknown): EmbedProps {
  return embedSchema.parse(value ?? {});
}
