import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { genreFilterFields, genreSortFields } from './model';

const genreFilterSchema = createFilterSchema(genreFilterFields);
const genreSortSchema = createSortSchema(genreSortFields);

export const genreListInputSchema = createSimpleListInputSchema({
  filterSchema: genreFilterSchema,
  sortSchema: genreSortSchema,
});
