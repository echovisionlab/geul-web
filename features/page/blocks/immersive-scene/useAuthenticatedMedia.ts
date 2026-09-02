'use client';

import { useEffect, useMemo, useState } from 'react';
import type { MediaDelivery } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { createFileClient } from '@/lib/api/browser-client';
import {
  collectImmersiveSceneMediaRequests,
  hydrateImmersiveSceneAssetProps,
  type ImmersiveSceneMediaDeliveryMap,
} from '@/lib/media/immersive-scene-hydration';
import {
  fetchMediaDeliveryBatches,
  mergeRecordBatches,
  uniqueMediaIdsInOrder,
} from '@/lib/media/media-delivery-batches';
import type { ImmersiveSceneProps } from './schema';

const pendingDeliveryRequests = new Map<string, Promise<ImmersiveSceneMediaDeliveryMap>>();

export async function fetchAuthenticatedImmersiveSceneMedia(
  fileIds: string[],
): Promise<ImmersiveSceneMediaDeliveryMap> {
  const uniqueFileIds = uniqueMediaIdsInOrder(fileIds);
  if (uniqueFileIds.length === 0) {
    return {};
  }

  const client = createFileClient();
  const responses = await fetchMediaDeliveryBatches(uniqueFileIds, (batch) =>
    client.getBulkMediaDeliveries({ fileIds: batch }),
  );
  const files = mergeRecordBatches(responses.map((response) => response.files));
  return Object.fromEntries(
    Object.entries(files).flatMap(([fileId, result]) =>
      result.delivery ? [[fileId, result.delivery] as [string, MediaDelivery]] : [],
    ),
  );
}

function loadAuthenticatedImmersiveSceneMedia(fileIds: string[], signature: string) {
  const pending = pendingDeliveryRequests.get(signature);
  if (pending) {
    return pending;
  }

  const request = fetchAuthenticatedImmersiveSceneMedia(fileIds);
  pendingDeliveryRequests.set(signature, request);
  void request.then(
    () => {
      if (pendingDeliveryRequests.get(signature) === request) {
        pendingDeliveryRequests.delete(signature);
      }
    },
    () => {
      if (pendingDeliveryRequests.get(signature) === request) {
        pendingDeliveryRequests.delete(signature);
      }
    },
  );
  return request;
}

export function useAuthenticatedImmersiveSceneProps(props: Partial<ImmersiveSceneProps>): Partial<ImmersiveSceneProps> {
  const fileIds = useMemo(
    () =>
      collectImmersiveSceneMediaRequests(props as Record<string, unknown>, {
        includeSourceWhenOptimized: true,
      })
        .map((request) => request.fileId)
        .sort(),
    [props.unitsJson],
  );
  const signature = fileIds.join('\n');
  const [hydration, setHydration] = useState<{
    signature: string;
    deliveries: ImmersiveSceneMediaDeliveryMap;
  }>({ signature: '', deliveries: {} });

  useEffect(() => {
    let cancelled = false;
    if (!signature) {
      setHydration({ signature: '', deliveries: {} });
      return () => {
        cancelled = true;
      };
    }

    void loadAuthenticatedImmersiveSceneMedia(signature.split('\n'), signature)
      .then((deliveries) => {
        if (!cancelled) {
          setHydration({ signature, deliveries });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHydration({ signature, deliveries: {} });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [signature]);

  return hydrateImmersiveSceneAssetProps(
    props as Record<string, unknown>,
    hydration.signature === signature ? hydration.deliveries : {},
    {
      mode: 'authenticated',
      includeSourceWhenOptimized: true,
    },
  ) as Partial<ImmersiveSceneProps>;
}
