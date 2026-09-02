import { z } from 'zod';
import { booleanString, imageAspectRatioSchema, listLayoutSchema, sortOrderSchema } from '../list-shared';

export const programEventListSchema = z.object({
  layout: listLayoutSchema.default('grid'),
  columns: z.string().default('3'),
  typeIds: z.string().default(''),
  seriesId: z.string().default(''),
  timeWindow: z.enum(['upcoming', 'current', 'past', 'all']).default('all'),
  sortBy: z.enum(['starts_at', 'ends_at', 'published_at', 'updated_at', 'title']).default('starts_at'),
  sortOrder: sortOrderSchema.default('asc'),
  limit: z.string().default('6'),
  showPagination: booleanString.default('false'),
  showImage: booleanString.default('true'),
  showMeta: booleanString.default('true'),
  imageAspectRatio: imageAspectRatioSchema.default('16:9'),
  carouselLoop: booleanString.default('true'),
  carouselIndicators: booleanString.default('true'),
});

export type ProgramEventListProps = z.infer<typeof programEventListSchema>;

export function parseProgramEventListProps(data: unknown): ProgramEventListProps {
  return programEventListSchema.parse(data ?? {});
}
