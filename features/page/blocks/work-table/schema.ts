import { z } from 'zod';

const booleanString = z.enum(['true', 'false']);

export const workTableSchema = z.object({
  workTypes: z.string().default(''),
  featuredOnly: booleanString.default('false'),
  statuses: z.string().default('WORK_STATUS_PUBLISHED'),
  filterFields: z.string().default('type,featured,status,year,published_at'),
  sortFields: z.string().default('published_at,updated_at,title'),
  pageSize: z.string().default('10'),
});

export type WorkTableProps = z.infer<typeof workTableSchema>;

export function parseWorkTableProps(data: unknown): WorkTableProps {
  return workTableSchema.parse(data ?? {});
}
