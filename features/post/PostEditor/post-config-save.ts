import type { DocumentLayout } from '@/features/document-layout';

export interface PostConfigPatch {
  commentsEnabled?: boolean;
  mapPlaceId?: string;
  documentLayout?: DocumentLayout;
}
