'use client';

import type { ReactNode } from 'react';
import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
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
      entityType={PublicMediaEntityType.WORK}
    >
      {children}
    </ContentMediaDeliveryProvider>
  );
}
