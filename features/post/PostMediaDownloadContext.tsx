'use client';

import type { ReactNode } from 'react';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
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
      entityType={PublicMediaEntityType.POST}
    >
      {children}
    </ContentMediaDeliveryProvider>
  );
}

export const usePostMediaDownload = useContentMediaDelivery;
