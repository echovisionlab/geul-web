import { z } from 'zod';

export const postTableSchema = z.object({
  categoryIds: z.string().default(''),
  tagIds: z.string().default(''),
  authorIds: z.string().default(''),
  seriesId: z.string().default(''),
  statuses: z.string().default('POST_STATUS_PUBLISHED,POST_STATUS_ARCHIVED'),
  filterFields: z.string().default('category_id,tag_id,author_id,series_id,status,published_at'),
  sortFields: z.string().default('published_at,title'),
  pageSize: z.string().default('10'),
});

export type PostTableProps = z.infer<typeof postTableSchema>;

export function parsePostTableProps(data: unknown): PostTableProps {
  return postTableSchema.parse(data ?? {});
}
