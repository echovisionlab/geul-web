'use client';
import { IconX } from '@tabler/icons-react';
import {
  Text,
  UNSTABLE_Toast as Toast,
  UNSTABLE_ToastContent as ToastContent,
  UNSTABLE_ToastRegion as ToastRegion,
} from 'react-aria-components';
import { IconButton } from '../IconButton/IconButton';
import { notificationQueue } from './notifications';
import classes from './Notification.module.css';
export function NotificationRegion({ closeLabel }: { closeLabel: string }) {
  return (
    <ToastRegion queue={notificationQueue} className={classes.region}>
      {({ toast }) => (
        <Toast toast={toast} className={classes.toast} data-tone={toast.content.tone ?? 'neutral'}>
          {toast.content.icon ? (
            <span aria-hidden className={classes.icon}>
              {toast.content.icon}
            </span>
          ) : null}
          <ToastContent className={classes.content}>
            <Text slot="title" className={toast.content.title ? classes.title : classes.message}>
              {toast.content.title ?? toast.content.message}
            </Text>
            {toast.content.title ? (
              <Text slot="description" className={classes.message}>
                {toast.content.message}
              </Text>
            ) : null}
          </ToastContent>
          <IconButton label={closeLabel} size="xs" onClick={() => notificationQueue.close(toast.key)}>
            <IconX size="1em" aria-hidden />
          </IconButton>
        </Toast>
      )}
    </ToastRegion>
  );
}
