import * as z from '@/lib/zod-mini';
import {
  collectionSizeSchema,
  booleanString,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '../list-shared';

export const labelListSchema = z.object({
  layout: z._default(listLayoutSchema, 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),
  sortBy: z._default(z.enum(['name', 'published_at']), 'name'),
  sortOrder: z._default(sortOrderSchema, 'asc'),
  limit: z._default(z.string(), '12'),
  showPagination: z._default(booleanString, 'false'),
  showImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(imageAspectRatioSchema, '1:1'),
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type LabelListProps = z.infer<typeof labelListSchema>;

export function parseLabelListProps(data: unknown): LabelListProps {
  return labelListSchema.parse(data ?? {});
}
