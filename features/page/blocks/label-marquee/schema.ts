import * as z from '@/lib/zod-mini';
import { marqueeEntitySchema } from '../marquee/schema';

export const labelMarqueeSchema = marqueeEntitySchema;

export type LabelMarqueeProps = z.infer<typeof labelMarqueeSchema>;

export function parseLabelMarqueeProps(data: unknown): LabelMarqueeProps {
  return labelMarqueeSchema.parse(data ?? {});
}
