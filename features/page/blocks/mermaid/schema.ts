import type { MermaidProps as SharedMermaidProps } from '@echovisionlab/geul-common/page';
import { z } from 'zod';
import { MERMAID_SOURCE_LIMIT } from '@/features/mermaid/mermaid-renderer';

export const mermaidSchema = z.object({
  source: z.string().max(MERMAID_SOURCE_LIMIT).default(''),
  title: z.string().default(''),
}) satisfies z.ZodType<SharedMermaidProps>;
export type MermaidProps = z.infer<typeof mermaidSchema>;
export function parseMermaidProps(value: unknown): MermaidProps {
  return mermaidSchema.parse(value ?? {});
}
