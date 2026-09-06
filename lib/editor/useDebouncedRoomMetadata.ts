'use client';

import { useLayoutEffect, useRef } from 'react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { BlockRoomMetadataError } from '@/lib/collab/block-room-metadata';
import type { BlockRoomConnection } from '@/lib/collab/useBlockRoomConnection';
import { useDebouncedPatch } from './useDebouncedPatch';

type MetadataConnection = Pick<BlockRoomConnection, 'protocol' | 'bootstrap' | 'acceptEpochAck' | 'reloadCanonical'>;
type Protocol = NonNullable<MetadataConnection['protocol']>;
type EpochAck = Parameters<MetadataConnection['acceptEpochAck']>[0];

export function useDebouncedRoomMetadata<T extends object>({
  connection,
  document,
  write,
  delay = 500,
}: {
  connection: MetadataConnection;
  document: string;
  write: (protocol: Protocol, patch: T) => Promise<EpochAck>;
  delay?: number;
}) {
  const t = useTranslations('common.notifications');
  const currentProtocol = useRef(connection.protocol);
  useLayoutEffect(() => {
    currentProtocol.current = connection.protocol;
    return () => {
      currentProtocol.current = null;
    };
  }, [connection.protocol]);
  return useDebouncedPatch({
    document,
    scope: connection.protocol,
    delay,
    write: async (patch: T) => {
      try {
        if (!connection.protocol || !connection.bootstrap) {
          throw new Error(t('saveFailed'));
        }
        const ack = await write(connection.protocol, patch);
        if (currentProtocol.current !== connection.protocol) {
          return;
        }
        if (connection.acceptEpochAck(ack) === false) {
          throw new Error(t('saveFailed'));
        }
      } catch (error) {
        if (currentProtocol.current !== connection.protocol) {
          throw error;
        }
        if (error instanceof BlockRoomMetadataError && error.reloadRequired) {
          connection.reloadCanonical();
        }
        notifications.show({ message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
        throw error;
      }
    },
  });
}
