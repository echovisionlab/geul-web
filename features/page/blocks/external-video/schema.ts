import type { ExternalVideoProps as SharedExternalVideoProps } from '@echovisionlab/geul-common/page';
import * as z from '@/lib/zod-mini';

export const externalVideoSchema = z.object({
  url: z._default(z.string(), ''),
  caption: z._default(z.string(), ''),
  aspectRatio: z._default(z.enum(['auto', '16:9', '4:3', '1:1', '9:16']), 'auto'),
}) satisfies z.ZodMiniType<SharedExternalVideoProps>;

export type ExternalVideoProps = z.infer<typeof externalVideoSchema>;

export function parseExternalVideoProps(value: unknown): ExternalVideoProps {
  return externalVideoSchema.parse(value ?? {});
}
