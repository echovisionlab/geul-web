'use client';

import type { ReactNode } from 'react';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { ContentMediaDeliveryProvider } from '@/features/media/ContentMediaDeliveryContext';

export function PageMediaDeliveryProvider({
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
      mediaAssetsEndpoint="/api/page/media-assets"
      mediaDownloadEndpoint="/api/page/media-download"
      entityType={PublicMediaEntityType.PAGE}
    >
      {children}
    </ContentMediaDeliveryProvider>
  );
}
