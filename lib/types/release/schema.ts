import { z } from 'zod';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import type { ReleaseStatus } from './model';
import { releaseFilterFields, releaseSortFields } from './table-spec';

export const releaseTypeSchema = z.enum(['album', 'compilation', 'ep', 'single']);
export const releaseStatusSchema: z.ZodType<ReleaseStatus> = z.enum(['draft', 'published']);
export const releaseTrackPendingUploadStatusSchema = z.enum(['pending', 'expired']);

// List input schema for DataTable
const releaseFilterSchema = createFilterSchema(releaseFilterFields);
const releaseSortSchema = createSortSchema(releaseSortFields);

export const releaseListInputSchema = createSimpleListInputSchema({
  filterSchema: releaseFilterSchema,
  sortSchema: releaseSortSchema,
});

export type { ReleaseStatus } from './model';

export function parseReleaseStatus(value: string | null | undefined): ReleaseStatus {
  if (!value) {
    return 'draft';
  }

  switch (value.trim()) {
    case 'draft':
    case 'RELEASE_STATUS_DRAFT':
      return 'draft';
    case 'published':
    case 'RELEASE_STATUS_PUBLISHED':
      return 'published';
    default:
      return 'draft';
  }
}

export const releaseArtistItemSchema = z.object({
  artist_id: z.uuid(),
  artist_name: z.string(),
  artist_slug: z.string().nullable(),
  sort_order: z.number(),
});

export const releaseLabelItemSchema = z.object({
  label_id: z.uuid(),
  label_name: z.string(),
  label_slug: z.string().nullable(),
  catalog_number: z.string().nullable(),
  sort_order: z.number(),
});

export const releaseGenreItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});

export const releaseCategoryItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});

export const releaseStyleItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
});

export const releaseFormatItemSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  format_description: z.string().nullable(),
});
