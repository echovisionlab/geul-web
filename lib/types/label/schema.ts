import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { labelFilterFields, labelSortFields } from './model';

const labelFilterSchema = createFilterSchema(labelFilterFields);
const labelSortSchema = createSortSchema(labelSortFields);

export const labelListInputSchema = createSimpleListInputSchema({
  filterSchema: labelFilterSchema,
  sortSchema: labelSortSchema,
});
