'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { createPostAction } from '@/lib/actions/post';

export function CreatePostButton() {
  const t = useTranslations('posts');
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const createPost = useMutation({
    mutationFn: () => createPostAction(),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      if (result.data) {
        const href = `/posts/${result.data.id}?edit=true`;
        startNavigation(() => {
          router.push(href);
        });
      }
    },
  });

  return (
    <Tooltip label={t('createTooltip')}>
      <IconButton
        emphasis="strong"
        size="lg"
        aria-label={t('createTooltip')}
        onClick={() => createPost.mutate()}
        loading={createPost.isPending || isNavigating}
        disabled={createPost.isPending || isNavigating}
      >
        <IconPlus size={20} />
      </IconButton>
    </Tooltip>
  );
}
