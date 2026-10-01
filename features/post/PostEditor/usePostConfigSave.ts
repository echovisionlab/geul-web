'use client';

import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { updatePostAction } from '@/lib/actions/post';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import type { PostConfigPatch } from './post-config-save';

/** One acknowledged, latest-field-wins queue for entity-wide Post configuration. */
export function usePostConfigSave(postId: string) {
  const tCommonNotifications = useTranslations('common.notifications');
  const mutation = useMutation({
    mutationFn: async (patch: PostConfigPatch) => {
      const result = await updatePostAction(postId, patch);
      if (!result.ok) {
        throw new Error(result.error);
      }
    },
    onError: (error) => {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonNotifications('updateFailed'),
        color: 'red',
      });
    },
  });

  return useDebouncedPatch<PostConfigPatch>({
    document: `post:${postId}`,
    recoveryScope: `post:${postId}:configuration`,
    scope: postId,
    delay: 500,
    write: (patch) => mutation.mutateAsync(patch),
  });
}
