import type { ValueType } from '../common/filter';
import type { GenericMetadata } from '../common/metadata';
import type { SocialLinks } from '../common/social-links';

export type LabelMetadata = GenericMetadata;

// Filter/Sort field definitions for DataTable
export const labelFilterFields = {
  id: 'uuid',
  name: 'string',
  slug: 'string',
  status: 'string',
  country_code: 'string',
  created_at: 'date',
} as const satisfies Record<string, ValueType>;

export const labelSortFields = ['name', 'releaseCount', 'created_at'] as const;

export type LabelStatus = 'draft' | 'published';

export interface LabelSelect {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  image_light_url: string | null;
  image_dark_url: string | null;
  description: string | null;
  country_code: string | null;
  website: string | null;
  social_links: SocialLinks;
  parent_label_id: string | null;
  metadata: LabelMetadata;
  status: LabelStatus;
  published_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
}

export interface LabelBasic {
  id: string;
  name: string;
  slug: string | null;
}

export interface LabelListItem {
  id: string;
  name: string;
  slug: string | null;
  image_url: string | null;
  image_light_url: string | null;
  image_dark_url: string | null;
  status: LabelStatus;
  releaseCount: number;
}

export interface UpdateLabelInput {
  name?: string;
  slug?: string;
  description?: string | null;
  country_code?: string | null;
  website?: string | null;
  social_links?: SocialLinks;
  parent_label_id?: string | null;
  status?: LabelStatus;
  published_at?: Date | null;
}
