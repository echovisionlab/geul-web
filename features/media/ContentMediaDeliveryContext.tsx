'use client';

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { FileDownloadAccess, PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import type { ContentBlockMediaSelector } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

interface AuthorizedDownloadResult {
  access?: FileDownloadAccess;
  download?: { url: string };
}

interface ContentMediaDeliveryContextValue {
  entityType: PublicMediaEntityType;
  entityId: string;
  authorizeDownload: (
    selector: Pick<ContentBlockMediaSelector, 'blockId' | 'referencePath'>,
  ) => Promise<AuthorizedDownloadResult>;
  resolveAsset: (fileId: string, kind: 'image' | 'video') => Promise<string>;
}

interface ContentMediaAssetItem {
  imageUrl: string;
  hlsUrl: string;
}

const ContentMediaDeliveryContext = createContext<ContentMediaDeliveryContextValue | null>(null);

export function ContentMediaDeliveryProvider({
  idOrSlug,
  requestedLocale,
  shareToken,
  sharePassword,
  mediaAssetsEndpoint,
  mediaDownloadEndpoint,
  entityType,
  children,
}: {
  idOrSlug: string;
  requestedLocale: string;
  shareToken?: string;
  sharePassword?: string;
  mediaAssetsEndpoint?: string;
  mediaDownloadEndpoint: string;
  entityType: PublicMediaEntityType;
  children: ReactNode;
}) {
  const mediaAssetsPromise = useRef<Promise<Record<string, ContentMediaAssetItem>> | null>(null);
  useEffect(() => {
    mediaAssetsPromise.current = null;
  }, [idOrSlug, requestedLocale, sharePassword, shareToken]);

  const request = useCallback(
    (endpoint: string, extra: Record<string, unknown> = {}) =>
      fetch(endpoint, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idOrSlug, requestedLocale, shareToken, sharePassword, ...extra }),
      }),
    [idOrSlug, requestedLocale, sharePassword, shareToken],
  );

  const authorizeDownload = useCallback(
    async (
      selector: Pick<ContentBlockMediaSelector, 'blockId' | 'referencePath'>,
    ): Promise<AuthorizedDownloadResult> => {
      const response = await request(mediaDownloadEndpoint, { selector });
      if (!response.ok) {
        throw new Error('Content media download authorization failed');
      }
      return response.json() as Promise<AuthorizedDownloadResult>;
    },
    [mediaDownloadEndpoint, request],
  );

  const resolveAsset = useCallback(
    async (fileId: string, kind: 'image' | 'video') => {
      if (!mediaAssetsEndpoint) {
        throw new Error(`Content ${kind} asset lookup is unavailable`);
      }
      if (!mediaAssetsPromise.current) {
        mediaAssetsPromise.current = request(mediaAssetsEndpoint)
          .then(async (response) => {
            if (!response.ok) {
              throw new Error('Content media asset lookup failed');
            }
            const result = (await response.json()) as {
              media?: Record<string, ContentMediaAssetItem>;
            };
            return result.media ?? {};
          })
          .finally(() => {
            mediaAssetsPromise.current = null;
          });
      }
      const item = (await mediaAssetsPromise.current)[fileId];
      const url = kind === 'image' ? item?.imageUrl : item?.hlsUrl;
      if (!url) {
        throw new Error(`Content ${kind} is unavailable`);
      }
      return url;
    },
    [mediaAssetsEndpoint, request],
  );

  return (
    <ContentMediaDeliveryContext.Provider value={{ authorizeDownload, entityId: idOrSlug, entityType, resolveAsset }}>
      {children}
    </ContentMediaDeliveryContext.Provider>
  );
}

export function useContentMediaDelivery() {
  return useContext(ContentMediaDeliveryContext);
}
