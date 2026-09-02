'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Select, TextInput } from '@/components/core/Input';
import { ConfirmModal, FormModal } from '@/components/core/Modal';
import { banUserAction, deleteUserAction, updateUserAction } from '@/lib/actions/user';
import { unsubscribeUserFromNewsletterAction } from '@/lib/actions/newsletter';
import { useUserModal } from './UserModalContext';

export function UserModals() {
  const tCommon = useTranslations('common');
  const tUserProfile = useTranslations('userProfile');
  const router = useRouter();
  const {
    banningUser,
    closeBan,
    roleUser,
    closeRole,
    deletingUser,
    closeDelete,
    newsletterUser,
    closeNewsletterUnsubscribe,
  } = useUserModal();

  // Ban state
  const [banReason, setBanReason] = useState('');
  const [banLoading, setBanLoading] = useState(false);

  // Role state
  const [newRole, setNewRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // Delete state
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [newsletterLoading, setNewsletterLoading] = useState(false);

  useEffect(() => {
    if (!banningUser) {
      setBanReason('');
    }
  }, [banningUser]);

  useEffect(() => {
    if (roleUser) {
      setNewRole(roleUser.role);
    } else {
      setNewRole(null);
    }
  }, [roleUser]);

  const handleBan = async () => {
    if (!banningUser) {
      return;
    }
    setBanLoading(true);
    try {
      const result = await banUserAction(banningUser.id, banReason || undefined);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.userBanned'), color: 'red' });
      closeBan();
      router.refresh();
    } finally {
      setBanLoading(false);
    }
  };

  const handleRoleUpdate = async () => {
    if (!roleUser || !newRole) {
      return;
    }
    setRoleLoading(true);
    try {
      const result = await updateUserAction(roleUser.id, { role: newRole });
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.roleUpdated'), color: 'green' });
      closeRole();
      router.refresh();
    } finally {
      setRoleLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) {
      return;
    }
    setDeleteLoading(true);
    try {
      const result = await deleteUserAction(deletingUser.id);
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.userDeleted'), color: 'red' });
      closeDelete();
      router.refresh();
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleNewsletterUnsubscribe = async () => {
    if (!newsletterUser) {
      return;
    }
    setNewsletterLoading(true);
    try {
      const result = await unsubscribeUserFromNewsletterAction(newsletterUser.id);
      if (!result.success) {
        notifications.show({ message: result.message, color: 'red' });
        return;
      }
      notifications.show({ message: result.message, color: 'green' });
      closeNewsletterUnsubscribe();
      router.refresh();
    } finally {
      setNewsletterLoading(false);
    }
  };

  return (
    <>
      {/* Ban Modal */}
      <FormModal
        opened={!!banningUser}
        onClose={closeBan}
        onSubmit={handleBan}
        title={tUserProfile('modals.ban.title')}
        submitLabel={tUserProfile('modals.ban.title')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        submitTone="danger"
        loading={banLoading}
      >
        <Stack>
          <Text size="sm">
            {tUserProfile.rich('modals.ban.description', {
              name: banningUser?.nickname || tCommon('entities.member'),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </Text>
          <TextInput
            label={tUserProfile('modals.ban.reasonLabel')}
            placeholder={tUserProfile('modals.ban.reasonPlaceholder')}
            value={banReason}
            onChange={(e) => setBanReason(e.currentTarget.value)}
          />
        </Stack>
      </FormModal>

      {/* Role Modal */}
      <FormModal
        opened={!!roleUser}
        onClose={closeRole}
        onSubmit={handleRoleUpdate}
        title={tCommon('actions.changeRole')}
        submitLabel={tUserProfile('modals.role.confirm')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={roleLoading}
        submitDisabled={!newRole}
      >
        <Select
          label={tCommon('labels.role')}
          data={[
            { value: 'user', label: tCommon('roles.user') },
            { value: 'author', label: tCommon('roles.author') },
            { value: 'admin', label: tCommon('roles.admin') },
          ]}
          value={newRole}
          onChange={setNewRole}
        />
      </FormModal>

      {/* Delete Modal */}
      <ConfirmModal
        opened={!!deletingUser}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tUserProfile('modals.delete.title')}
        message={
          <Stack gap="xs">
            <Text>
              {tUserProfile.rich('modals.delete.description', {
                name: deletingUser?.nickname || tCommon('entities.member'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </Text>
            <Text size="sm" c="dimmed">
              {tUserProfile('modals.delete.warning')}
            </Text>
          </Stack>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
      <ConfirmModal
        opened={!!newsletterUser}
        onClose={closeNewsletterUnsubscribe}
        onConfirm={handleNewsletterUnsubscribe}
        title={tUserProfile('modals.newsletterUnsubscribe.title')}
        message={tUserProfile('modals.newsletterUnsubscribe.description', {
          name: newsletterUser?.nickname || tCommon('entities.member'),
        })}
        confirmLabel={tCommon('actions.unsubscribe')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={newsletterLoading}
      />
    </>
  );
}
