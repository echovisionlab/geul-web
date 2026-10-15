import * as z from '@/lib/zod-mini';

export const postTableSchema = z.object({
  categoryIds: z._default(z.string(), ''),
  tagIds: z._default(z.string(), ''),
  authorIds: z._default(z.string(), ''),
  seriesId: z._default(z.string(), ''),
  statuses: z._default(z.string(), 'POST_STATUS_PUBLISHED,POST_STATUS_ARCHIVED'),
  filterFields: z._default(z.string(), 'category_id,tag_id,author_id,series_id,status,published_at'),
  sortFields: z._default(z.string(), 'published_at,title'),
  pageSize: z._default(z.string(), '10'),
});

export type PostTableProps = z.infer<typeof postTableSchema>;

export function parsePostTableProps(data: unknown): PostTableProps {
  return postTableSchema.parse(data ?? {});
}
