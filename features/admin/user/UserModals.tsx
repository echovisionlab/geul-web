'use client';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { notifications } from '@/components/core/Notification';
import { Select, TextInput } from '@/components/core/Input';
import { FormModal } from '@/components/core/Modal';
import { banUserAction, deleteUserAction, updateUserAction } from '@/lib/actions/user';
import { unsubscribeUserFromNewsletterAction } from '@/lib/actions/newsletter';
import { useUserModal } from './UserModalContext';
import { adminMemberName } from './member-name';

export interface UserModalsBindings {
  banUserAction: typeof banUserAction;
  deleteUserAction: typeof deleteUserAction;
  updateUserAction: typeof updateUserAction;
  unsubscribeUserFromNewsletterAction: typeof unsubscribeUserFromNewsletterAction;
}
const defaultBindings: UserModalsBindings = {
  banUserAction,
  deleteUserAction,
  updateUserAction,
  unsubscribeUserFromNewsletterAction,
};
export function UserModals({
  bindings = defaultBindings,
  refresh,
}: { bindings?: UserModalsBindings; refresh?: () => void } = {}) {
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
      const result = await bindings.banUserAction(banningUser.id, banReason || undefined);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.userBanned'), tone: 'positive' });
      closeBan();
      (refresh ?? router.refresh)();
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
      const result = await bindings.updateUserAction(roleUser.id, { role: newRole });
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.roleUpdated'), tone: 'positive' });
      closeRole();
      (refresh ?? router.refresh)();
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
      const result = await bindings.deleteUserAction(deletingUser.id);
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tUserProfile('notifications.userDeleted'), tone: 'positive' });
      closeDelete();
      (refresh ?? router.refresh)();
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
      const result = await bindings.unsubscribeUserFromNewsletterAction(newsletterUser.id);
      if (!result.success) {
        notifications.show({ message: result.message, tone: 'danger' });
        return;
      }
      notifications.show({ message: result.message, tone: 'positive' });
      closeNewsletterUnsubscribe();
      (refresh ?? router.refresh)();
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
        <DsLayoutStack>
          <DsText>
            {tUserProfile.rich('modals.ban.description', {
              name: banningUser
                ? adminMemberName(banningUser, tCommon('labels.nicknameNotSet'))
                : tCommon('entities.member'),
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
          </DsText>
          <TextInput
            label={tUserProfile('modals.ban.reasonLabel')}
            placeholder={tUserProfile('modals.ban.reasonPlaceholder')}
            value={banReason}
            onChange={(e) => setBanReason(e.currentTarget.value)}
          />
        </DsLayoutStack>
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
      <ConfirmationDialog
        intent="delete"
        opened={!!deletingUser}
        onClose={closeDelete}
        onConfirm={handleDelete}
        title={tUserProfile('modals.delete.title')}
        message={
          <DsLayoutStack gap="xs">
            <DsText>
              {tUserProfile.rich('modals.delete.description', {
                name: deletingUser
                  ? adminMemberName(deletingUser, tCommon('labels.nicknameNotSet'))
                  : tCommon('entities.member'),
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </DsText>
            <DsText size="sm" tone="secondary">
              {tUserProfile('modals.delete.warning')}
            </DsText>
          </DsLayoutStack>
        }
        confirmLabel={tCommon('actions.delete')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={deleteLoading}
      />
      <ConfirmationDialog
        intent="confirm"
        opened={!!newsletterUser}
        onClose={closeNewsletterUnsubscribe}
        onConfirm={handleNewsletterUnsubscribe}
        title={tUserProfile('modals.newsletterUnsubscribe.title')}
        message={tUserProfile('modals.newsletterUnsubscribe.description', {
          name: newsletterUser
            ? adminMemberName(newsletterUser, tCommon('labels.nicknameNotSet'))
            : tCommon('entities.member'),
        })}
        confirmLabel={tCommon('actions.unsubscribe')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={newsletterLoading}
      />
    </>
  );
}
