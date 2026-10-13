'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';

interface CopyNotificationOptions {
  successMessage: string;
  errorMessage?: string;
}

export function useCopyToClipboard(timeout = 2000) {
  const { copy: copyToClipboard, copied, error, reset: resetClipboard } = useClipboard({ timeout });
  const pendingNotificationRef = useRef<CopyNotificationOptions | null>(null);

  useEffect(() => {
    if (!copied || !pendingNotificationRef.current) {
      return;
    }

    notifications.show({
      message: pendingNotificationRef.current.successMessage,
      tone: 'neutral',
    });
    pendingNotificationRef.current = null;
  }, [copied]);

  useEffect(() => {
    if (!error || !pendingNotificationRef.current?.errorMessage) {
      return;
    }

    notifications.show({
      message: pendingNotificationRef.current.errorMessage,
      tone: 'danger',
    });
    pendingNotificationRef.current = null;
  }, [error]);

  const copy = useCallback(
    (value: string, options: CopyNotificationOptions) => {
      pendingNotificationRef.current = options;
      resetClipboard();
      copyToClipboard(value);
    },
    [copyToClipboard, resetClipboard],
  );

  return {
    copy,
    copied,
    error,
    reset: resetClipboard,
  };
}
