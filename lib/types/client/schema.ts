import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { clientFilterFields, clientSortFields } from './model';

const clientFilterSchema = createFilterSchema(clientFilterFields);
const clientSortSchema = createSortSchema(clientSortFields);

export const clientListInputSchema = createSimpleListInputSchema({
  filterSchema: clientFilterSchema,
  sortSchema: clientSortSchema,
});
