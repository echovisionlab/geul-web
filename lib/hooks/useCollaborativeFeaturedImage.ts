'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createFileClient } from '@/lib/api/browser-client';
import { createClientLogger } from '@/lib/utils/client-logger';

const logger = createClientLogger('useCollaborativeFeaturedImage');

interface UseCollaborativeFeaturedImageOptions {
  entityKey: string;
  fileId: string | null | undefined;
  initialUrl: string | null;
  enabled: boolean;
}

interface HydratedImageState {
  entityKey: string;
  url: string | null;
}

interface HydratedFileState {
  entityKey: string;
  fileId: string | null | undefined;
}

type GetMediaDeliveryResponse = Awaited<ReturnType<ReturnType<typeof createFileClient>['getMediaDelivery']>>;

const HYDRATION_RETRY_DELAYS_MS = [0, 250, 1_000] as const;

function resolveImageUrl(response: GetMediaDeliveryResponse) {
  const delivery = response.delivery;
  return delivery?.thumbnail?.url || delivery?.asset?.url || delivery?.inline?.url || null;
}

export function useCollaborativeFeaturedImage({
  entityKey,
  fileId,
  initialUrl,
  enabled,
}: UseCollaborativeFeaturedImageOptions) {
  const [hydratedImage, setHydratedImage] = useState<HydratedImageState>({
    entityKey,
    url: initialUrl,
  });
  const hydratedFileRef = useRef<HydratedFileState>({ entityKey, fileId: undefined });
  const requestGenerationRef = useRef(0);
  const [hydrationRequest, setHydrationRequest] = useState(0);

  useEffect(() => {
    requestGenerationRef.current += 1;
    hydratedFileRef.current = { entityKey, fileId: undefined };
    setHydratedImage({ entityKey, url: initialUrl });
  }, [entityKey, initialUrl]);

  useEffect(() => {
    const generation = ++requestGenerationRef.current;

    if (fileId === undefined) {
      hydratedFileRef.current = { entityKey, fileId };
      setHydratedImage({ entityKey, url: initialUrl });
      return;
    }

    if (fileId === null) {
      hydratedFileRef.current = { entityKey, fileId };
      setHydratedImage({ entityKey, url: null });
      return;
    }

    if (!enabled) {
      return;
    }

    if (hydratedFileRef.current.entityKey === entityKey && hydratedFileRef.current.fileId === fileId) {
      return;
    }

    setHydratedImage({ entityKey, url: null });
    const client = createFileClient();
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let resolveRetry: (() => void) | null = null;
    const isCurrentRequest = () => requestGenerationRef.current === generation;
    const waitForRetry = (delayMs: number) =>
      new Promise<void>((resolve) => {
        resolveRetry = resolve;
        retryTimeout = setTimeout(() => {
          retryTimeout = null;
          resolveRetry = null;
          resolve();
        }, delayMs);
      });

    void (async () => {
      let lastError: unknown;
      let lastAttemptHadNoUrl = false;

      for (const delayMs of HYDRATION_RETRY_DELAYS_MS) {
        if (delayMs > 0) {
          await waitForRetry(delayMs);
        }
        if (!isCurrentRequest()) {
          return;
        }

        try {
          const response = await client.getMediaDelivery({ fileId });
          if (!isCurrentRequest()) {
            return;
          }
          const url = resolveImageUrl(response);
          if (url) {
            hydratedFileRef.current = { entityKey, fileId };
            setHydratedImage({ entityKey, url });
            return;
          }
          lastError = undefined;
          lastAttemptHadNoUrl = true;
        } catch (error: unknown) {
          lastError = error;
          lastAttemptHadNoUrl = false;
        }
      }

      if (!isCurrentRequest()) {
        return;
      }
      if (lastAttemptHadNoUrl) {
        logger.warn('Collaborative featured image delivery has no display URL', {
          entityKey,
          fileId,
        });
        return;
      }
      logger.warn('Failed to hydrate collaborative featured image', {
        entityKey,
        fileId,
        error: lastError instanceof Error ? lastError.message : String(lastError),
      });
    })();

    return () => {
      if (retryTimeout !== null) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
        resolveRetry?.();
        resolveRetry = null;
      }
      if (requestGenerationRef.current === generation) {
        requestGenerationRef.current += 1;
      }
    };
  }, [enabled, entityKey, fileId, hydrationRequest, initialUrl]);

  const setFeaturedImage = useCallback(
    (nextFileId: string | null, url: string | null) => {
      requestGenerationRef.current += 1;
      hydratedFileRef.current = {
        entityKey,
        fileId: url || nextFileId === null ? nextFileId : undefined,
      };
      setHydratedImage({ entityKey, url });
      if (nextFileId !== null && !url) {
        setHydrationRequest((request) => request + 1);
      }
    },
    [entityKey],
  );

  return {
    featuredImageUrl: hydratedImage.entityKey === entityKey ? hydratedImage.url : initialUrl,
    setFeaturedImage,
  };
}
