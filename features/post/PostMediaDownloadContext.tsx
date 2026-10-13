'use client';

import type { ReactNode } from 'react';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';
import { ContentMediaDeliveryProvider, useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';

export function PostMediaDownloadProvider({
  idOrSlug,
  requestedLocale,
  shareToken,
  sharePassword,
  children,
}: {
  idOrSlug: string;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
  children: ReactNode;
}) {
  return (
    <ContentMediaDeliveryProvider
      idOrSlug={idOrSlug}
      requestedLocale={requestedLocale}
      shareToken={shareToken}
      sharePassword={sharePassword}
      mediaAssetsEndpoint="/api/post/media-assets"
      mediaDownloadEndpoint="/api/post/media-download"
      entityType={PUBLIC_MEDIA_ENTITY_TYPE.POST}
    >
      {children}
    </ContentMediaDeliveryProvider>
  );
}

export const usePostMediaDownload = useContentMediaDelivery;
