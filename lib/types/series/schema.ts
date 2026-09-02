import { z } from 'zod';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { seriesFilterFields, seriesSortFields } from './model';

export const seriesStatusSchema = z.enum(['draft', 'published']);

const seriesFilterSchema = createFilterSchema(seriesFilterFields);
const seriesSortSchema = createSortSchema(seriesSortFields);

export const seriesListInputSchema = createSimpleListInputSchema({
  filterSchema: seriesFilterSchema,
  sortSchema: seriesSortSchema,
});
