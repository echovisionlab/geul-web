'use client';

import { IconCloud, IconCloudOff, IconCloudExclamation, IconCloudX, IconRefresh } from '@tabler/icons-react';
import { resolveTransportSaveState, type EditorSaveState } from './save-state';
import { Tooltip } from '../Tooltip';
import classes from './EditorHeaderView.module.css';

export type CollabSyncStatusIndicatorProps = (
  | {
      /** Durable state supplied by the editor save model. */
      state: EditorSaveState;
      isConnected?: never;
      isSynced?: never;
    }
  | {
      /** Compatibility for transport-only rooms. Block rooms must supply state. */
      state?: never;
      isConnected: boolean;
      isSynced: boolean;
    }
) & {
  label: string;
  withTooltip?: boolean;
};

export function CollabSyncStatusIndicator(props: CollabSyncStatusIndicatorProps) {
  if (Object.hasOwn(props, 'size')) {
    throw new RangeError('Collaboration indicator size is owned by Core');
  }
  const { label, withTooltip = true } = props;
  const status = props.state ?? resolveTransportSaveState(props.isConnected, props.isSynced);
  const color =
    status === 'saved'
      ? 'var(--geul-status-positive)'
      : status === 'error' || status === 'rejected'
        ? 'var(--geul-status-danger)'
        : status === 'offline'
          ? 'var(--geul-text-muted)'
          : 'var(--geul-status-warning)';
  const Icon =
    status === 'offline'
      ? IconCloudOff
      : status === 'error'
        ? IconCloudExclamation
        : status === 'rejected'
          ? IconCloudX
          : status === 'reload'
            ? IconRefresh
            : IconCloud;

  const content = (
    <span className={classes.syncIndicator} data-collab-status={status} role="img" aria-label={label}>
      <Icon size="1em" color={color} aria-hidden />
    </span>
  );

  if (!withTooltip) {
    return content;
  }

  return <Tooltip label={label}>{content}</Tooltip>;
}
