import { z } from 'zod';
import { marqueeCommonSchema } from '../marquee/schema';

export const textMarqueeSchema = marqueeCommonSchema.extend({
  itemsJson: z.string().default('[]'),
});

export type TextMarqueeProps = z.infer<typeof textMarqueeSchema>;

export function parseTextMarqueeProps(data: unknown): TextMarqueeProps {
  return textMarqueeSchema.parse(data ?? {});
}
