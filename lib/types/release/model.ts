import type { CreditTargetType } from '../common/credit';
import type { GenericMetadata } from '../common/metadata';
import type { TrackBasic, TrackCreditItem } from '../track/model';

export type { CreditTargetType };
export type ReleaseStatus = 'draft' | 'published';
export { releaseFilterFields, releaseSortFields } from './table-spec';

export interface ReleaseTrackItem extends TrackBasic {
  credits: TrackCreditItem[];
}

export type ReleaseType = 'album' | 'compilation' | 'ep' | 'single';

export type ReleaseMetadata = GenericMetadata;

export interface ReleaseSelect {
  id: string;
  title: string;
  slug: string | null;
  type: ReleaseType;
  release_date: Date | null;
  description: string | null;
  artwork_url: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  bandcamp_url: string | null;
  youtube_music_url: string | null;
  metadata: ReleaseMetadata;
  status: ReleaseStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ReleaseBasic {
  id: string;
  title: string;
  slug: string | null;
  type: ReleaseType;
  artwork_url: string | null;
  release_date: Date | null;
}

export interface ReleaseCreditItem {
  id: string;
  credit_type: CreditTargetType;
  // Artist credit
  artist_id: string | null;
  artist_name: string | null;
  artist_slug: string | null;
  // User credit
  member_id: string | null;
  member_name: string | null;
  // Text credit
  credited_name: string | null;
  // Common
  credit_role: string | null;
  sort_order: number;
}

export interface ReleaseArtistItem {
  artist_id: string;
  artist_name: string;
  artist_slug: string | null;
  sort_order: number;
}

export interface ReleaseLabelItem {
  label_id: string;
  label_name: string;
  label_slug: string | null;
  catalog_number: string | null;
  sort_order: number;
}

export interface ReleaseGenreItem {
  id: string;
  name: string;
  slug: string;
}

export interface ReleaseCategoryItem {
  id: string;
  name: string;
  slug: string;
}

export interface ReleaseStyleItem {
  id: string;
  name: string;
  slug: string;
}

export interface ReleaseFormatItem {
  id: string;
  name: string;
  slug: string;
  format_description: string | null;
}

export interface ReleaseWithRelations extends ReleaseSelect {
  artists: ReleaseArtistItem[];
  credits: ReleaseCreditItem[];
  labels: ReleaseLabelItem[];
  categories: ReleaseCategoryItem[];
  genres: ReleaseGenreItem[];
  styles: ReleaseStyleItem[];
  formats: ReleaseFormatItem[];
  tracks: ReleaseTrackItem[];
}

export interface ReleaseListItem extends ReleaseBasic {
  mainArtists: string[];
}

// Type matching the listReleasesAdminAction return type
export interface ReleaseAdminListItem {
  id: string;
  title: string;
  slug: string | null;
  type: string;
  artworkUrl: string | null;
  releaseDate: Date | null;
  status: string;
  trackCount: number;
  creditCount: number;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface UpdateReleaseInput {
  slug?: string;
  type?: ReleaseType;
  release_date?: Date | string | null;
  description?: string | null;
  spotify_url?: string | null;
  apple_music_url?: string | null;
  bandcamp_url?: string | null;
  youtube_music_url?: string | null;
  status?: ReleaseStatus;
}

export interface SetCreditsInput {
  // One of these must be set
  artist_id?: string | null;
  member_id?: string | null;
  credited_name?: string | null;
  // Optional
  credit_role?: string | null;
  sort_order?: number;
}

export interface SetLabelsInput {
  label_id: string;
  catalog_number?: string | null;
  sort_order?: number;
}

export interface SetFormatsInput {
  format_id: string;
  format_description?: string | null;
}
