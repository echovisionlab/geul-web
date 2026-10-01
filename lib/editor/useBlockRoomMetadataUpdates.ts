'use client';

import { useLayoutEffect, useRef } from 'react';
import type { BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import type { BlockRoomMetadataUpdate } from '@/lib/collab/block-room-protocol';
import { getPendingEditorPatch, subscribeToEditorSaveState } from './editor-save-registry';

/** Adopt committed peer fields while preserving fields with outstanding local edits. */
export function useBlockRoomMetadataUpdates(
  connection: Pick<BlockRoomConnection, 'protocol'>,
  document: string,
  onUpdate: (update: BlockRoomMetadataUpdate) => void,
) {
  const callback = useRef(onUpdate);
  useLayoutEffect(() => {
    callback.current = onUpdate;
  });
  useLayoutEffect(() => {
    const latest = new Map<BlockRoomMetadataUpdate['operation'], BlockRoomMetadataUpdate>();
    const adopt = () => {
      const pending = getPendingEditorPatch(document);
      for (const update of latest.values()) {
        const values = Object.fromEntries(
          Object.entries(update.values).filter(([key]) => !Object.hasOwn(pending, key)),
        );
        // Page's queue retains the desired and observed layout to express per-property intent.
        if (
          update.operation === 'page_layout' &&
          isRecord(values.documentLayout) &&
          isRecord(pending.value) &&
          isRecord(pending.previous)
        ) {
          const desired = pending.value;
          const observed = pending.previous;
          const peerLayout = Object.fromEntries(
            Object.entries(values.documentLayout).filter(([key]) => desired[key] === observed[key]),
          );
          if (Object.keys(peerLayout).length) {
            values.documentLayout = peerLayout;
          } else {
            delete values.documentLayout;
          }
        }
        if (Object.keys(values).length > 0) {
          callback.current({ ...update, values });
        }
      }
    };
    const unsubscribe = connection.protocol?.subscribeMetadata?.((update) => {
      latest.set(update.operation, {
        ...update,
        values: { ...latest.get(update.operation)?.values, ...update.values },
      });
      adopt();
    });
    const unsubscribeSave = subscribeToEditorSaveState(document, adopt);
    return () => {
      unsubscribe?.();
      unsubscribeSave();
    };
  }, [connection.protocol, document]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
