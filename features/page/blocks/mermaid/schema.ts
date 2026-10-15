import type { MermaidProps as SharedMermaidProps } from '@echovisionlab/geul-common/page';
import * as z from '@/lib/zod-mini';
import { MERMAID_SOURCE_LIMIT } from '@/features/mermaid/mermaid-renderer';

export const mermaidSchema = z.object({
  source: z._default(z.string().check(z.maxLength(MERMAID_SOURCE_LIMIT)), ''),
  title: z._default(z.string(), ''),
}) satisfies z.ZodMiniType<SharedMermaidProps>;
export type MermaidProps = z.infer<typeof mermaidSchema>;
export function parseMermaidProps(value: unknown): MermaidProps {
  return mermaidSchema.parse(value ?? {});
}
