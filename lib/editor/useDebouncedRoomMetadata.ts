'use client';

import { getProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { SaveParkedError } from './save-failure';
import { useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { BlockRoomMetadataError } from '@/lib/collab/block-room-metadata';
import type { BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { mergeMetadataPatches } from './merge-metadata-patches';
import { useDebouncedPatch } from './useDebouncedPatch';

type MetadataConnection = Pick<BlockRoomConnection, 'protocol' | 'bootstrap' | 'acceptEpochAck' | 'reloadCanonical'> &
  Partial<Pick<BlockRoomConnection, 'provider'>>;
type Protocol = NonNullable<MetadataConnection['protocol']>;
type EpochAck = Parameters<MetadataConnection['acceptEpochAck']>[0];

export function useDebouncedRoomMetadata<T extends object>({
  connection,
  document,
  write,
  delay = 500,
  operation = 'locale',
}: {
  connection: MetadataConnection;
  document: string;
  write: (protocol: Protocol, patch: T) => Promise<EpochAck>;
  delay?: number;
  operation?: 'locale' | 'document';
}) {
  const t = useTranslations('common.notifications');
  const currentProtocol = useRef(connection.protocol);
  const currentWriter = useRef({ connection, write });
  useLayoutEffect(() => {
    currentWriter.current = { connection, write };
  });
  const roomName = connection.protocol?.documentName ?? connection.bootstrap?.documentName;
  const lastRoom = useRef<{ document: string; room: string | undefined }>({ document, room: roomName });
  if (lastRoom.current.document !== document || roomName) {
    lastRoom.current = { document, room: roomName };
  }
  const queueScope = roomName ?? lastRoom.current.room ?? document;
  useLayoutEffect(() => {
    currentProtocol.current = connection.protocol;
    return () => {
      currentProtocol.current = null;
    };
  }, [connection.protocol]);
  const queue = useDebouncedPatch({
    document,
    scope: queueScope,
    merge: mergeMetadataPatches,
    retry: true,
    recoveryScope: roomName ?? lastRoom.current.room ?? null,
    recoveryKey: `room-${operation}`,
    delay,
    write: async (patch: T) => {
      const activeProtocol = currentProtocol.current;
      // A room downgraded to view keeps the fields for a page reopened with edit access.
      if (getProviderAccessLevel(currentWriter.current.connection.provider) === 'view') {
        throw new SaveParkedError();
      }
      try {
        const active = currentWriter.current;
        if (!activeProtocol || !active.connection.bootstrap) {
          throw new Error(t('saveFailed'));
        }
        const ack = await active.write(activeProtocol, patch);
        if (currentProtocol.current !== activeProtocol) {
          throw new Error('Collaboration connection changed while saving.');
        }
        if (active.connection.acceptEpochAck(ack) === false) {
          throw new Error(t('saveFailed'));
        }
      } catch (error) {
        if (currentProtocol.current !== activeProtocol) {
          throw error;
        }
        if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
          currentWriter.current.connection.reloadCanonical();
        }
        // The shared save registry announces the first failure and clears it on recovery.
        throw error;
      }
    },
  });
  useEffect(() => {
    const flushPending = () => {
      // A ready room with edit access also takes back fields parked while it was read-only.
      if (queue.hasParked() && getProviderAccessLevel(currentWriter.current.connection.provider) === 'edit') {
        queue.resumeParked();
      }
      if (queue.hasPending()) {
        void queue.flush();
      }
    };
    const unsubscribe = connection.protocol?.subscribeReady?.(flushPending);
    if (connection.protocol && connection.bootstrap) {
      flushPending();
    }
    return unsubscribe;
  }, [connection.protocol, connection.bootstrap?.documentName, queue]);
  return queue;
}
