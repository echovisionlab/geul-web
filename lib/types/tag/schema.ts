import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { tagFilterFields, tagSortFields } from './model';

const tagFilterSchema = createFilterSchema(tagFilterFields);
const tagSortSchema = createSortSchema(tagSortFields);

export const tagListInputSchema = createSimpleListInputSchema({
  filterSchema: tagFilterSchema,
  sortSchema: tagSortSchema,
});
