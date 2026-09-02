import { z } from 'zod';
import { booleanString, imageAspectRatioSchema, listLayoutSchema, sortOrderSchema } from '../list-shared';

export const labelListSchema = z.object({
  layout: listLayoutSchema.default('grid'),
  columns: z.string().default('3'),
  sortBy: z.enum(['name', 'published_at']).default('name'),
  sortOrder: sortOrderSchema.default('asc'),
  limit: z.string().default('12'),
  showPagination: booleanString.default('false'),
  showImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: imageAspectRatioSchema.default('1:1'),
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type LabelListProps = z.infer<typeof labelListSchema>;

export function parseLabelListProps(data: unknown): LabelListProps {
  return labelListSchema.parse(data ?? {});
}
