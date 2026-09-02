'use client';

import { IconCloud, IconCloudOff } from '@tabler/icons-react';
import { Tooltip } from '../Tooltip';

export interface CollabSyncStatusIndicatorProps {
  isConnected: boolean;
  isSynced: boolean;
  label: string;
  size?: number;
  withTooltip?: boolean;
}

export function CollabSyncStatusIndicator({
  isConnected,
  isSynced,
  label,
  size = 16,
  withTooltip = true,
}: CollabSyncStatusIndicatorProps) {
  const status = isConnected ? (isSynced ? 'synced' : 'syncing') : 'offline';
  const color = isConnected
    ? isSynced
      ? 'var(--mantine-color-green-6)'
      : 'var(--mantine-color-yellow-6)'
    : 'var(--mantine-color-gray-5)';

  const content = (
    <span data-collab-status={status} aria-label={label}>
      {isConnected ? <IconCloud size={size} color={color} /> : <IconCloudOff size={size} color={color} />}
    </span>
  );

  if (!withTooltip) {
    return content;
  }

  return <Tooltip label={label}>{content}</Tooltip>;
}
