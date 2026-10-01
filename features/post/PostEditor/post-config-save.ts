import type { DocumentLayout } from '@/features/document-layout';

export interface PostConfigPatch {
  slug?: string;
  commentsEnabled?: boolean;
  mapPlaceId?: string;
  layoutContentHeight?: DocumentLayout['contentHeight'];
  layoutPageChrome?: DocumentLayout['pageChrome'];
  layoutFooter?: DocumentLayout['footer'];
}

export function diffPostLayout(
  current: DocumentLayout,
  next: DocumentLayout,
): Pick<PostConfigPatch, 'layoutContentHeight' | 'layoutPageChrome' | 'layoutFooter'> {
  return {
    ...(current.contentHeight === next.contentHeight ? {} : { layoutContentHeight: next.contentHeight }),
    ...(current.pageChrome === next.pageChrome ? {} : { layoutPageChrome: next.pageChrome }),
    ...(current.footer === next.footer ? {} : { layoutFooter: next.footer }),
  };
}
