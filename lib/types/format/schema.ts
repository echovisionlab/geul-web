import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { formatFilterFields, formatSortFields } from './model';

const formatFilterSchema = createFilterSchema(formatFilterFields);
const formatSortSchema = createSortSchema(formatSortFields);

export const formatListInputSchema = createSimpleListInputSchema({
  filterSchema: formatFilterSchema,
  sortSchema: formatSortSchema,
});
