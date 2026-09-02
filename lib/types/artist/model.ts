import type { Json } from '@echovisionlab/geul-common/types';
import type { ValueType } from '../common/filter';
import type { SocialLinks } from '../common/social-links';

// Filter/Sort field definitions for DataTable (Admin)
export const artistFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  country_code: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const artistSortFields = ['name', 'releaseCount', 'created_at'] as const;

// Filter/Sort field definitions for My Artists page
export const myArtistFilterFields = {
  name: 'string',
} as const satisfies Record<string, ValueType>;

export const myArtistSortFields = ['name', 'created_at'] as const;

// List item for my/artists page
export interface MyArtistListItem {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  role: string;
  created_at: Date | null;
}

export interface ArtistBasic {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
}

/**
 * Level 2: List item for tables and card grids
 * Includes basic fields + status, counts, and simple lookups
 */
export interface ArtistListItem extends ArtistBasic {
  country_code: string | null;
  releaseCount: number;
  created_at: Date | null;
}

export interface ArtistDisplayInfo extends ArtistBasic {
  bio: Json | null;
  bio_html: string | null;
  social_links: SocialLinks;
}

export interface CreateArtistInput {
  name: string;
  slug: string;
  real_name?: string;
  bio?: string;
  country_code?: string;
  website?: string;
  social_links?: SocialLinks;
}

export interface UpdateArtistInput {
  name?: string;
  slug?: string;
  real_name?: string | null;
  bio?: string | null;
  bio_html?: string | null;
  country_code?: string | null;
  website?: string | null;
  social_links?: SocialLinks;
}
