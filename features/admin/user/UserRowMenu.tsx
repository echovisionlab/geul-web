'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconBan, IconCheck, IconMailOff, IconTrash, IconUserCog } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { TableRowMenu, type TableRowMenuItem } from '@/components/core/DataTable';
import { unbanUserAction } from '@/lib/actions/user';
import { useUserModal, type UserModalTarget } from './UserModalContext';

interface UserRowMenuProps {
  user: UserModalTarget;
}

export function UserRowMenu({ user }: UserRowMenuProps) {
  const tCommon = useTranslations('common');
  const tTable = useTranslations('dataTable');
  const tUserProfile = useTranslations('userProfile');
  const router = useRouter();
  const { openBan, openRole, openDelete, openNewsletterUnsubscribe } = useUserModal();
  const [unbanning, setUnbanning] = useState(false);

  const handleUnban = async () => {
    setUnbanning(true);
    try {
      const result = await unbanUserAction(user.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.userUnbanned'), color: 'green' });
      router.refresh();
    } finally {
      setUnbanning(false);
    }
  };

  const items: TableRowMenuItem[] = [
    {
      label: tCommon('actions.changeRole'),
      icon: <IconUserCog size={16} />,
      onClick: () => openRole(user),
    },
  ];

  if (user.role !== 'admin') {
    if (user.banned) {
      items.push({
        label: tCommon('actions.unban'),
        icon: <IconCheck size={16} />,
        onClick: handleUnban,
        disabled: unbanning,
      });
    } else {
      items.push({
        label: tCommon('actions.ban'),
        icon: <IconBan size={16} />,
        onClick: () => openBan(user),
        color: 'orange',
      });
    }
  }

  if (user.newsletter_subscribed) {
    items.push({
      label: tCommon('actions.unsubscribe'),
      icon: <IconMailOff size={16} />,
      onClick: () => openNewsletterUnsubscribe(user),
      color: 'orange',
    });
  }

  items.push({
    label: tCommon('actions.delete'),
    icon: <IconTrash size={16} />,
    onClick: () => openDelete(user),
    color: 'red',
  });

  return <TableRowMenu aria-label={tTable('aria.rowActions', { label: user.nickname })} items={items} />;
}
