'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconPlus } from '@tabler/icons-react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { IconButton } from '@/components/core/IconButton';
import { Tooltip } from '@/components/core/Tooltip';
import { createPostAction } from '@/lib/actions/post';

export interface CreatePostButtonProps {
  createAction?: typeof createPostAction;
  onCreated?: (id: string) => void;
}
export function CreatePostButton({ createAction = createPostAction, onCreated }: CreatePostButtonProps = {}) {
  const t = useTranslations('posts');
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const createPost = useMutation({
    mutationFn: () => createAction(),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      if (result.data) {
        if (onCreated) {
          onCreated(result.data.id);
          return;
        }
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
        emphasis="medium"
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
