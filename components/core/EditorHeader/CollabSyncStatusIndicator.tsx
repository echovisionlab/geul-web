'use client';

import { IconCloud, IconCloudOff } from '@tabler/icons-react';
import { Tooltip } from '../Tooltip';
import classes from './EditorHeaderView.module.css';

export interface CollabSyncStatusIndicatorProps {
  isConnected: boolean;
  isSynced: boolean;
  label: string;
  withTooltip?: boolean;
}

export function CollabSyncStatusIndicator(props: CollabSyncStatusIndicatorProps) {
  if (Object.hasOwn(props, 'size')) {
    throw new RangeError('Collaboration indicator size is owned by Core');
  }
  const { isConnected, isSynced, label, withTooltip = true } = props;
  const status = isConnected ? (isSynced ? 'synced' : 'syncing') : 'offline';
  const color = isConnected
    ? isSynced
      ? 'var(--geul-status-positive)'
      : 'var(--geul-status-warning)'
    : 'var(--geul-text-muted)';

  const content = (
    <span className={classes.syncIndicator} data-collab-status={status} role="img" aria-label={label}>
      {isConnected ? (
        <IconCloud size="1em" color={color} aria-hidden />
      ) : (
        <IconCloudOff size="1em" color={color} aria-hidden />
      )}
    </span>
  );

  if (!withTooltip) {
    return content;
  }

  return <Tooltip label={label}>{content}</Tooltip>;
}
