import * as z from '@/lib/zod-mini';
import { marqueeEntitySchema } from '../marquee/schema';

export const clientMarqueeSchema = marqueeEntitySchema;

export type ClientMarqueeProps = z.infer<typeof clientMarqueeSchema>;

export function parseClientMarqueeProps(data: unknown): ClientMarqueeProps {
  return clientMarqueeSchema.parse(data ?? {});
}
