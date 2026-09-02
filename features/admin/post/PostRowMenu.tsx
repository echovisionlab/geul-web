'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconEye, IconRefresh, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useTranslations } from 'next-intl';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { republishPostAction } from '@/lib/actions/post';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import { usePostModal, type PostModalTarget } from './PostModalContext';

interface PostRowMenuProps {
  post: PostModalTarget;
}

export function PostRowMenu({ post }: PostRowMenuProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const tCommon = useTranslations('common.actions');
  const tDataTable = useTranslations('dataTable.aria');
  const tPostEditor = useTranslations('postEditor');
  const { openDelete } = usePostModal();
  const status = normalizeEnumToken(post.status);

  const items: TableRowMenuItem[] = [];

  if (status === 'published' || status === 'archived') {
    items.push({
      label: tCommon('view'),
      icon: <IconEye size={16} />,
      href: `/posts/${post.slug || post.id}`,
    });
  }

  if (status === 'archived') {
    items.push({
      label: tPostEditor('statusActions.republish'),
      icon: <IconRefresh size={16} />,
      disabled: isPending,
      onClick: () => {
        startTransition(async () => {
          const result = await republishPostAction(post.id);
          if (result.error) {
            notifications.show({ message: result.error, color: 'red' });
            return;
          }
          notifications.show({ message: tPostEditor('notifications.republished'), color: 'green' });
          router.refresh();
        });
      },
    });
  }

  items.push({
    label: tCommon('delete'),
    icon: <IconTrash size={16} />,
    onClick: () => openDelete(post),
    color: 'red',
    disabled: isPending,
  });

  return (
    <TableRowMenu
      aria-label={tDataTable('rowActions', {
        label: post.title || 'post',
      })}
      items={items}
    />
  );
}
