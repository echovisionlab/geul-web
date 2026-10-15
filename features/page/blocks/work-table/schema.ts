import * as z from '@/lib/zod-mini';

const booleanString = z.enum(['true', 'false']);

export const workTableSchema = z.object({
  workTypes: z._default(z.string(), ''),
  featuredOnly: z._default(booleanString, 'false'),
  statuses: z._default(z.string(), 'WORK_STATUS_PUBLISHED'),
  filterFields: z._default(z.string(), 'type,featured,status,year,published_at'),
  sortFields: z._default(z.string(), 'published_at,updated_at,title'),
  pageSize: z._default(z.string(), '10'),
});

export type WorkTableProps = z.infer<typeof workTableSchema>;

export function parseWorkTableProps(data: unknown): WorkTableProps {
  return workTableSchema.parse(data ?? {});
}
