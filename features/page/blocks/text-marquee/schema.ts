import * as z from '@/lib/zod-mini';
import { marqueeCommonSchema } from '../marquee/schema';

export const textMarqueeSchema = z.extend(marqueeCommonSchema, {
  itemsJson: z._default(z.string(), '[]'),
});

export type TextMarqueeProps = z.infer<typeof textMarqueeSchema>;

export function parseTextMarqueeProps(data: unknown): TextMarqueeProps {
  return textMarqueeSchema.parse(data ?? {});
}
