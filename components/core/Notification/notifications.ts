'use client';
import type { ClosedVisualProps } from '../visual-contract';
import type { ReactNode } from 'react';
// The queue is the store; the region (React Aria toast UI) loads on demand in NotificationHost.
import { ToastQueue } from 'react-stately/useToastState';
import type { ControlTone } from '../control-style';
export interface NotificationOptions extends ClosedVisualProps {
  message: ReactNode;
  title?: ReactNode;
  tone?: ControlTone;
  icon?: ReactNode;
  autoClose?: false;
}
export const notificationQueue = new ToastQueue<NotificationOptions>({ maxVisibleToasts: 3 });
export const notifications = {
  show(options: NotificationOptions) {
    return notificationQueue.add(options, {
      timeout: options.autoClose === false || options.tone === 'danger' ? undefined : 5000,
    });
  },
  hide(key: string) {
    notificationQueue.close(key);
  },
  clean() {
    notificationQueue.clear();
  },
};
