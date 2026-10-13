'use client';

import type { ReactNode } from 'react';
import { PUBLIC_MEDIA_ENTITY_TYPE } from '@/features/media-download/download-wire-values';
import { ContentMediaDeliveryProvider } from '@/features/media/ContentMediaDeliveryContext';

export function WorkMediaDeliveryProvider({
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
      mediaDownloadEndpoint="/api/work/media-download"
      entityType={PUBLIC_MEDIA_ENTITY_TYPE.WORK}
    >
      {children}
    </ContentMediaDeliveryProvider>
  );
}
