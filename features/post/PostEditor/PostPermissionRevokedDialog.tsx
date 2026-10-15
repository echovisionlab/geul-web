'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { EditorPermissionRevokedDialog } from '@/features/editor/EditorPermissionRevokedDialog';
import {
  navigateAfterPostPermissionRevoked,
  type NavigateToDestination,
  type ResolvePostRevokedDestination,
} from './post-permission-revocation';

export function PostPermissionRevokedDialog({
  opened,
  postId,
  resolveDestination,
  navigate,
}: {
  opened: boolean;
  postId: string;
  resolveDestination?: ResolvePostRevokedDestination;
  navigate?: NavigateToDestination;
}) {
  const t = useTranslations('postEditor.notifications');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    const navigated = await navigateAfterPostPermissionRevoked(postId, resolveDestination, navigate);
    if (!navigated) {
      setLoading(false);
      notifications.show({ message: t('permissionRevokedNavigationFailed'), tone: 'danger' });
    }
  };

  return <EditorPermissionRevokedDialog opened={opened} loading={loading} onConfirm={() => void handleConfirm()} />;
}
