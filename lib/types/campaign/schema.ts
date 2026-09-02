import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { campaignFilterFields, campaignSortFields } from './model';

const campaignFilterSchema = createFilterSchema(campaignFilterFields);
const campaignSortSchema = createSortSchema(campaignSortFields);

export const campaignListInputSchema = createSimpleListInputSchema({
  filterSchema: campaignFilterSchema,
  sortSchema: campaignSortSchema,
});
