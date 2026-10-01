import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface PostConfigurationSnapshot {
  configurationRevision: string;
  slug: string | null;
  commentsEnabled: boolean;
  mapPlaceId: string | null;
  documentLayout: DocumentLayout;
}
