import { z } from 'zod';
import {
  releaseArtistItemSchema,
  releaseCategoryItemSchema,
  releaseFormatItemSchema,
  releaseGenreItemSchema,
  releaseLabelItemSchema,
  releaseStyleItemSchema,
  releaseTrackPendingUploadStatusSchema,
  releaseTypeSchema,
} from '@/lib/types/release/schema';
import { baseCreditItemSchema } from '@/lib/types/common/credit';
import { trackBasicSchema } from '@/lib/types/track/schema';

// Track with credits for collab
export const releaseTrackItemSchema = trackBasicSchema.extend({
  pending_upload_file_id: z.string().optional(),
  pending_upload_attempt_id: z.string().optional(),
  pending_upload_status: releaseTrackPendingUploadStatusSchema.optional(),
  pending_upload_started_at: z.iso.datetime().optional(),
  credits: z.array(baseCreditItemSchema),
});

export const ReleaseFieldsSchema = z.object({
  // Basic info
  type: releaseTypeSchema,
  releaseDate: z.string().nullable(),
  artworkUrl: z.string().nullable(),
  // description is handled via Y.XmlFragment, not in this schema
  // Streaming links
  spotifyUrl: z.string(),
  appleMusicUrl: z.string(),
  bandcampUrl: z.string(),
  youtubeMusicUrl: z.string(),
  // Relations
  artists: z.array(releaseArtistItemSchema),
  credits: z.array(baseCreditItemSchema),
  labels: z.array(releaseLabelItemSchema),
  categories: z.array(releaseCategoryItemSchema),
  genres: z.array(releaseGenreItemSchema),
  styles: z.array(releaseStyleItemSchema),
  formats: z.array(releaseFormatItemSchema),
  tracks: z.array(releaseTrackItemSchema),
});

export type ReleaseFields = z.infer<typeof ReleaseFieldsSchema>;
export type ReleaseTrackItem = z.infer<typeof releaseTrackItemSchema>;

export const DEFAULT_RELEASE_FIELDS: ReleaseFields = {
  type: 'album',
  releaseDate: null,
  artworkUrl: null,
  spotifyUrl: '',
  appleMusicUrl: '',
  bandcampUrl: '',
  youtubeMusicUrl: '',
  artists: [],
  credits: [],
  labels: [],
  categories: [],
  genres: [],
  styles: [],
  formats: [],
  tracks: [],
};

export const RELEASE_FIELDS_JSON_KEYS: ReadonlySet<keyof ReleaseFields> = new Set([
  'artists',
  'credits',
  'labels',
  'categories',
  'genres',
  'styles',
  'formats',
  'tracks',
]);
