import type { ExternalVideoProps as SharedExternalVideoProps } from '@echovisionlab/geul-common/page';
import { z } from 'zod';

export const externalVideoSchema = z.object({
  url: z.string().default(''),
  caption: z.string().default(''),
  aspectRatio: z.enum(['auto', '16:9', '4:3', '1:1', '9:16']).default('auto'),
}) satisfies z.ZodType<SharedExternalVideoProps>;

export type ExternalVideoProps = z.infer<typeof externalVideoSchema>;

export function parseExternalVideoProps(value: unknown): ExternalVideoProps {
  return externalVideoSchema.parse(value ?? {});
}
