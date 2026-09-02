import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { categoryFilterFields, categorySortFields } from './model';

const categoryFilterSchema = createFilterSchema(categoryFilterFields);
const categorySortSchema = createSortSchema(categorySortFields);

export const categoryListInputSchema = createSimpleListInputSchema({
  filterSchema: categoryFilterSchema,
  sortSchema: categorySortSchema,
});
