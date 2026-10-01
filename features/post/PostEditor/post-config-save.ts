import type { DocumentLayout } from '@/features/document-layout';

export interface PostConfigPatch {
  slug?: string;
  commentsEnabled?: boolean;
  mapPlaceId?: string;
  documentLayout?: DocumentLayout;
}
