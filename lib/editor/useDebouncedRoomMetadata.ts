'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { BlockRoomMetadataError } from '@/lib/collab/block-room-metadata';
import type { BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { mergeMetadataPatches } from './merge-metadata-patches';
import { useDebouncedPatch } from './useDebouncedPatch';

type MetadataConnection = Pick<BlockRoomConnection, 'protocol' | 'bootstrap' | 'acceptEpochAck' | 'reloadCanonical'>;
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
        notifications.show({ message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
        throw error;
      }
    },
  });
  useEffect(() => {
    const flushPending = () => {
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
