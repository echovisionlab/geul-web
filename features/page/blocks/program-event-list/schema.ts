import * as z from '@/lib/zod-mini';
import {
  collectionSizeSchema,
  booleanString,
  imageAspectRatioSchema,
  listLayoutSchema,
  sortOrderSchema,
} from '../list-shared';

export const programEventListSchema = z.object({
  layout: z._default(listLayoutSchema, 'grid'),
  itemSize: collectionSizeSchema,
  columns: z._default(z.string(), '3'),
  typeIds: z._default(z.string(), ''),
  seriesId: z._default(z.string(), ''),
  timeWindow: z._default(z.enum(['upcoming', 'current', 'past', 'all']), 'all'),
  sortBy: z._default(z.enum(['starts_at', 'ends_at', 'published_at', 'updated_at', 'title']), 'starts_at'),
  sortOrder: z._default(sortOrderSchema, 'asc'),
  limit: z._default(z.string(), '6'),
  showPagination: z._default(booleanString, 'false'),
  showImage: z._default(booleanString, 'true'),
  showMeta: z._default(booleanString, 'true'),
  imageAspectRatio: z._default(imageAspectRatioSchema, '16:9'),
  carouselLoop: z._default(booleanString, 'true'),
  carouselIndicators: z._default(booleanString, 'true'),
});

export type ProgramEventListProps = z.infer<typeof programEventListSchema>;

export function parseProgramEventListProps(data: unknown): ProgramEventListProps {
  return programEventListSchema.parse(data ?? {});
}
