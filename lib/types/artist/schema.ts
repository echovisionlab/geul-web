import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { artistFilterFields, artistSortFields, myArtistFilterFields, myArtistSortFields } from './model';

const artistFilterSchema = createFilterSchema(artistFilterFields);
const artistSortSchema = createSortSchema(artistSortFields);

export const artistListInputSchema = createSimpleListInputSchema({
  filterSchema: artistFilterSchema,
  sortSchema: artistSortSchema,
});

// Schema for my/artists page
const myArtistFilterSchema = createFilterSchema(myArtistFilterFields);
const myArtistSortSchema = createSortSchema(myArtistSortFields);

export const myArtistListInputSchema = createSimpleListInputSchema({
  filterSchema: myArtistFilterSchema,
  sortSchema: myArtistSortSchema,
});
