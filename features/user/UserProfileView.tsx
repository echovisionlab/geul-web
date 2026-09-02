'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { UserProfileView as UserProfileFeatureView, type UserProfileSocialLink } from '@/features/user/ui/UserProfile';
import { banUserAction, deleteUserAction, unbanUserAction, updateUserAction } from '@/lib/actions/user';
import { PLATFORM_CONFIGS, type SocialLinks } from '@/lib/types/common/social-links';
import { buildManagedImageUrl, MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';
import { getDisplaySocialLinkEntries } from '@/lib/utils/social-links';

export interface UserProfileViewUser {
  id: string;
  name: string | null;
  image: string | null;
  bio: string | null;
  social_links: SocialLinks | null;
  role: string | null;
  banned: boolean | null;
  ban_reason: string | null;
  created_at: Date | null;
  isAdmin: boolean;
  isSelf: boolean;
  deleted?: boolean;
}

export interface UserProfileViewProps {
  user: UserProfileViewUser;
}

interface UserActionResult {
  success?: boolean;
  error?: string;
}

export function UserProfileView({ user }: UserProfileViewProps) {
  const t = useTranslations('userProfile');
  const tCommon = useTranslations('common');
  const tSocialLinks = useTranslations('socialLinks');
  const router = useRouter();
  const queryClient = useQueryClient();
  const dateTime = useDateTimeFormatter();

  const [banReason, setBanReason] = useState('');
  const [newRole, setNewRole] = useState<string | null>(null);
  const [banModalOpened, banModal] = useDisclosure(false);
  const [roleModalOpened, roleModal] = useDisclosure(false);
  const [deleteModalOpened, deleteModal] = useDisclosure(false);

  const refreshProfile = () => {
    void queryClient.invalidateQueries({ queryKey: ['user', 'profile', user.id] });
    router.refresh();
  };

  const updateUser = useMutation<void, Error, { id: string; role: string }>({
    mutationFn: async ({ id, role }) => {
      await requireSuccessfulAction(updateUserAction(id, { role }));
    },
    onSuccess: () => {
      notifications.show({ message: t('notifications.roleUpdated'), color: 'green' });
      refreshProfile();
      roleModal.close();
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const ban = useMutation<void, Error, { id: string; reason?: string }>({
    mutationFn: async ({ id, reason }) => {
      await requireSuccessfulAction(banUserAction(id, reason));
    },
    onSuccess: () => {
      notifications.show({ message: t('notifications.userBanned'), color: 'red' });
      refreshProfile();
      banModal.close();
      setBanReason('');
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const unban = useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await requireSuccessfulAction(unbanUserAction(id));
    },
    onSuccess: () => {
      notifications.show({ message: t('notifications.userUnbanned'), color: 'green' });
      refreshProfile();
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const deleteUser = useMutation<void, Error, { id: string }>({
    mutationFn: async ({ id }) => {
      await requireSuccessfulAction(deleteUserAction(id));
    },
    onSuccess: () => {
      notifications.show({ message: t('notifications.userDeleted'), color: 'red' });
      deleteModal.close();
      router.push('/admin/users');
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const displayName = user.name?.trim() ?? '';
  const socialLinks = useMemo(() => buildSocialLinks(user.social_links ?? {}), [user.social_links]);
  const joinedLabel = user.created_at ? `${t('joined')} ${dateTime.date(user.created_at)}` : null;
  const roleLabel =
    user.role === 'admin'
      ? tCommon('roles.admin')
      : user.role === 'author'
        ? tCommon('roles.author')
        : user.role === 'user'
          ? tCommon('roles.user')
          : user.role;

  const openRoleModal = () => {
    updateUser.reset();
    setNewRole(user.role ?? 'user');
    roleModal.open();
  };

  const closeRoleModal = () => {
    if (updateUser.isPending) {
      return;
    }
    updateUser.reset();
    roleModal.close();
  };

  const openBanModal = () => {
    ban.reset();
    banModal.open();
  };

  const closeBanModal = () => {
    if (ban.isPending) {
      return;
    }
    ban.reset();
    setBanReason('');
    banModal.close();
  };

  const openDeleteModal = () => {
    deleteUser.reset();
    deleteModal.open();
  };

  const closeDeleteModal = () => {
    if (deleteUser.isPending) {
      return;
    }
    deleteUser.reset();
    deleteModal.close();
  };

  const richDescription = (key: 'modals.ban.description' | 'modals.delete.description'): ReactNode =>
    t.rich(key, {
      name: displayName,
      strong: (chunks) => <strong>{chunks}</strong>,
    });

  return (
    <UserProfileFeatureView
      profile={{
        name: displayName,
        initials: getInitials(displayName),
        avatarUrl: buildManagedImageUrl(user.image, MANAGED_IMAGE_PRESET.AVATAR_LG) ?? null,
        roleLabel,
        joinedLabel,
        bio: user.bio,
        socialLinks,
        banned: Boolean(user.banned),
        banReason: user.isAdmin && user.banned && user.ban_reason ? `${t('banReason')}: ${user.ban_reason}` : null,
        showAdminActions: user.isAdmin && !user.isSelf,
      }}
      labels={{
        title: t('title'),
        back: tCommon('actions.back'),
        socialLinks: tSocialLinks('label'),
        banned: t('states.banned'),
        changeRole: tCommon('actions.changeRole'),
        ban: t('actions.ban'),
        unban: t('actions.unban'),
        delete: tCommon('actions.delete'),
        banDialog: {
          title: t('modals.ban.title'),
          description: richDescription('modals.ban.description'),
          reason: t('modals.ban.reasonLabel'),
          reasonPlaceholder: t('modals.ban.reasonPlaceholder'),
          confirm: t('modals.ban.title'),
          cancel: tCommon('actions.cancel'),
          close: tCommon('actions.close'),
        },
        roleDialog: {
          title: tCommon('actions.changeRole'),
          role: tCommon('labels.role'),
          confirm: t('modals.role.confirm'),
          cancel: tCommon('actions.cancel'),
          close: tCommon('actions.close'),
        },
        deleteDialog: {
          title: t('modals.delete.title'),
          description: richDescription('modals.delete.description'),
          warning: t('modals.delete.warning'),
          confirm: tCommon('actions.delete'),
          cancel: tCommon('actions.cancel'),
          close: tCommon('actions.close'),
        },
      }}
      dialogs={{
        ban: {
          opened: banModalOpened,
          pending: ban.isPending,
          error: mutationErrorMessage(ban.error, tCommon('statuses.failed')),
          reason: banReason,
        },
        role: {
          opened: roleModalOpened,
          pending: updateUser.isPending,
          error: mutationErrorMessage(updateUser.error, tCommon('statuses.failed')),
          value: newRole,
          options: [
            { value: 'user', label: tCommon('roles.user') },
            { value: 'author', label: tCommon('roles.author') },
            { value: 'admin', label: tCommon('roles.admin') },
          ],
        },
        delete: {
          opened: deleteModalOpened,
          pending: deleteUser.isPending,
          error: mutationErrorMessage(deleteUser.error, tCommon('statuses.failed')),
        },
      }}
      events={{
        onBack: router.back,
        onOpenBan: openBanModal,
        onCloseBan: closeBanModal,
        onBanReasonChange: setBanReason,
        onConfirmBan: () => ban.mutate({ id: user.id, reason: banReason.trim() || undefined }),
        onUnban: () => unban.mutate({ id: user.id }),
        onOpenRole: openRoleModal,
        onCloseRole: closeRoleModal,
        onRoleChange: setNewRole,
        onConfirmRole: () => {
          if (newRole) {
            updateUser.mutate({ id: user.id, role: newRole });
          }
        },
        onOpenDelete: openDeleteModal,
        onCloseDelete: closeDeleteModal,
        onConfirmDelete: () => deleteUser.mutate({ id: user.id }),
      }}
      unbanPending={unban.isPending}
    />
  );
}

async function requireSuccessfulAction(action: Promise<UserActionResult>) {
  const result = await action;
  if (result.error) {
    throw new Error(result.error);
  }
}

function mutationErrorMessage(error: Error | null, fallback: string) {
  if (!error) {
    return null;
  }
  return error.message || fallback;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase();
}

function buildSocialLinks(links: SocialLinks): UserProfileSocialLink[] {
  return getDisplaySocialLinkEntries(links).map(({ key, platform, url }) => {
    const config = PLATFORM_CONFIGS[platform];
    return {
      key,
      href: url,
      label: config.label,
      platform,
    };
  });
}
