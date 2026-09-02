'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconBan, IconCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Divider, Group, Modal, Stack, Text } from '@mantine/core';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { Select, TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { UserBanStateSection, UserDeliveryEmailSection, UserSsoProvidersSection } from '@/features/admin/user/auth';
import { UserProfileFormSection, type AdminUserProfileFormValues } from '@/features/admin/user/UserProfileFormSection';
import { PersonalAccessTokenSettings } from '@/features/my/PersonalAccessTokenSettings';
import { projectPersonalAccessTokensForSettings } from '@/features/my/mcp-integration-access';
import { getEmailSuppressionAction, releaseEmailSuppressionAction } from '@/lib/actions/email-suppression';
import { listAccountPersonalAccessTokensAction } from '@/lib/actions/personal-access-token';
import {
  banUserAction,
  getUserAdminAction,
  removeUserSsoProviderAction,
  setUserCanonicalEmailAction,
  unbanUserAction,
  updateUserAction,
} from '@/lib/actions/user';
import { listAllUserTagsAction } from '@/lib/actions/user-tag';
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { guardNotFound } from '@/lib/utils/not-found-guard';

export default function AdminUserEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonActions = useTranslations('common.actions');
  const tPage = useTranslations('adminUserDetail');
  const tSecurityEmail = useTranslations('security.email');
  const { copy } = useCopyToClipboard();
  const { data: user, isLoading } = useQuery({
    queryKey: ['users', 'admin', id],
    queryFn: () => getUserAdminAction(id),
  });
  const { data: memberTags = [] } = useQuery({
    queryKey: ['memberTags', 'admin', 'all'],
    queryFn: listAllUserTagsAction,
  });
  const { data: emailSuppression, isLoading: isSuppressionLoading } = useQuery({
    queryKey: ['emailSuppression', user?.email],
    queryFn: () => getEmailSuppressionAction(user?.email ?? ''),
    enabled: Boolean(user?.email),
  });
  const { data: personalAccessTokens, isLoading: arePersonalAccessTokensLoading } = useQuery({
    queryKey: ['personalAccessToken', 'admin', id],
    queryFn: () => listAccountPersonalAccessTokensAction(id),
  });

  const [banModalOpened, { open: openBanModal, close: closeBanModal }] = useDisclosure(false);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<string | null>('permanent');
  const [website, setWebsite] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const invalidateUserQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['users', 'admin', id] });
    queryClient.invalidateQueries({ queryKey: ['users', 'admin', 'list'] });
  };

  const updateUser = useMutation({
    mutationFn: (data: {
      id: string;
      nickname?: string;
      bio?: string | null;
      website?: string | null;
      socialLinks?: Record<string, string> | null;
      role?: string;
      tagIds?: string[];
    }) =>
      updateUserAction(data.id, {
        ...data,
        social_links: data.socialLinks,
        tag_ids: data.tagIds,
      }),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.updated'), color: 'green' });
      invalidateUserQueries();
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const banUser = useMutation({
    mutationFn: (data: { id: string; reason?: string; banExpiresIn?: number }) =>
      banUserAction(data.id, data.reason, data.banExpiresIn),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.banned'), color: 'red' });
      invalidateUserQueries();
      closeBanModal();
      setBanReason('');
      setBanDuration('permanent');
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const unbanUser = useMutation({
    mutationFn: (data: { id: string }) => unbanUserAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.unbanned'), color: 'green' });
      invalidateUserQueries();
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const setCanonicalEmail = useMutation({
    mutationFn: (email: string) => setUserCanonicalEmailAction(id, email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tSecurityEmail('canonicalUpdated'), color: 'green' });
      invalidateUserQueries();
      queryClient.invalidateQueries({ queryKey: ['emailSuppression'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const removeSsoProvider = useMutation({
    mutationFn: (data: { provider: string; identifier: string }) =>
      removeUserSsoProviderAction(id, data.provider, data.identifier),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({ message: tPage('notifications.ssoProviderRemoved'), color: 'green' });
      invalidateUserQueries();
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const releaseSuppression = useMutation({
    mutationFn: (email: string) => releaseEmailSuppressionAction(email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, color: 'red' });
        return;
      }
      notifications.show({
        message: tPage('notifications.emailSuppressionReleased'),
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['emailSuppression', user?.email] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, color: 'red' });
    },
  });

  const form = useForm<AdminUserProfileFormValues>({
    initialValues: {
      nickname: '',
      bio: '',
      role: 'user',
      tagIds: [],
    },
  });

  useEffect(() => {
    if (user) {
      form.setValues({
        nickname: user.nickname,
        bio: user.bio ?? '',
        role: user.role ?? 'user',
        tagIds: user.tag_ids,
      });
      setWebsite(user.website ?? '');
      setSocialLinks(user.social_links || {});
    }
  }, [user]);

  if (isLoading) {
    return <PageLoader />;
  }

  guardNotFound(user);

  const handleSubmit = form.onSubmit((values) => {
    updateUser.mutate({
      id,
      nickname: values.nickname,
      role: values.role,
      tagIds: values.tagIds,
      bio: values.bio || null,
      website: website || null,
      socialLinks,
    });
  });

  const handleImageChange = async () => {
    await queryClient.invalidateQueries({ queryKey: ['users', 'admin', id] });
  };

  const handleBan = () => {
    banUser.mutate({
      id,
      reason: banReason || undefined,
      banExpiresIn: banDuration === 'permanent' ? undefined : Number(banDuration),
    });
  };

  const handleCopyUserId = () => {
    copy(user?.id ?? id, {
      successMessage: tPage('notifications.userIdCopied'),
      errorMessage: tPage('notifications.userIdCopyFailed'),
    });
  };

  const handleSetCanonicalEmail = async (email: string) => {
    const result = await setCanonicalEmail.mutateAsync(email);
    return !result.error;
  };

  const handleRemoveSsoProvider = async (provider: string, identifier: string) => {
    const result = await removeSsoProvider.mutateAsync({ provider, identifier });
    return !result.error;
  };

  return (
    <Stack>
      <EditorHeader
        title={user?.nickname ?? tCommon('entities.member')}
        isConnected
        isSynced
        hideConnectionStatus
        hideStatus
        onBack={() => router.push('/admin/users')}
        backTooltip={tCommonActions('back')}
      />

      {user?.banned && (
        <Alert tone="danger" title={tPage('alerts.bannedTitle')}>
          <Stack gap="xs">
            {user.ban_reason && (
              <Text size="sm">
                {tPage('alerts.reasonLabel')}: {user.ban_reason}
              </Text>
            )}
            {user.ban_expires ? (
              <Text size="sm">
                {tPage('alerts.expiresLabel')}: <DateTime value={user.ban_expires} display="dateTime" />
              </Text>
            ) : (
              <Text size="sm">
                {tCommonLabels('duration')}: {tPage('durations.permanent')}
              </Text>
            )}
            <Button
              size="xs"
              tone="positive"
              leftSection={<IconCheck size={14} />}
              onClick={() => unbanUser.mutate({ id })}
              loading={unbanUser.isPending}
              w="fit-content"
            >
              {tCommonActions('unban')}
            </Button>
          </Stack>
        </Alert>
      )}

      <form id="admin-user-profile-form" onSubmit={handleSubmit}>
        <UserProfileFormSection
          user={user}
          memberId={id}
          form={form}
          website={website}
          socialLinks={socialLinks}
          tagOptions={memberTags.map((tag) => ({ value: tag.id, label: tag.name }))}
          onWebsiteChange={setWebsite}
          onSocialLinksChange={setSocialLinks}
          onImageChange={handleImageChange}
          onCopyUserId={handleCopyUserId}
        />
      </form>

      <Divider />

      <Stack gap="lg">
        <UserSsoProvidersSection
          auth={user.auth_details}
          onRemoveProvider={handleRemoveSsoProvider}
          isRemoveProviderPending={removeSsoProvider.isPending}
        />
        <Divider />
        <UserDeliveryEmailSection
          user={user}
          suppression={emailSuppression}
          isSuppressionLoading={isSuppressionLoading}
          isReleasePending={releaseSuppression.isPending}
          onReleaseSuppression={(email) => releaseSuppression.mutate(email)}
          onSetCanonicalEmail={handleSetCanonicalEmail}
          isSetCanonicalEmailPending={setCanonicalEmail.isPending}
        />
        <Divider />
        <UserBanStateSection user={user} />
        {!arePersonalAccessTokensLoading ? (
          <>
            <Divider />
            <PersonalAccessTokenSettings
              subjectId={id}
              mode="admin"
              initialPersonalAccessTokens={projectPersonalAccessTokensForSettings(
                personalAccessTokens?.personalAccessTokens ?? [],
              )}
              initialLoadFailed={Boolean(personalAccessTokens?.error)}
            />
          </>
        ) : null}
      </Stack>

      <Group justify="space-between" align="center">
        <Group>
          {user?.role !== 'admin' && !user?.banned && (
            <Button
              type="button"
              tone="danger"
              emphasis="medium"
              leftSection={<IconBan size={16} />}
              onClick={openBanModal}
            >
              {tCommonActions('ban')}
            </Button>
          )}
        </Group>
        <Button type="submit" form="admin-user-profile-form" loading={updateUser.isPending}>
          {tCommonActions('save')}
        </Button>
      </Group>

      <Modal opened={banModalOpened} onClose={closeBanModal} title={tPage('modal.title')}>
        <Stack>
          <TextInput
            label={tPage('modal.reasonLabel')}
            placeholder={tPage('modal.reasonPlaceholder')}
            value={banReason}
            onChange={(e) => setBanReason(e.currentTarget.value)}
          />
          <Select
            label={tCommonLabels('duration')}
            data={[
              { value: '86400', label: tPage('durations.oneDay') },
              { value: '604800', label: tPage('durations.sevenDays') },
              { value: '2592000', label: tPage('durations.thirtyDays') },
              { value: 'permanent', label: tPage('durations.permanent') },
            ]}
            value={banDuration}
            onChange={setBanDuration}
          />
          <Group justify="flex-end">
            <Button emphasis="low" onClick={closeBanModal}>
              {tCommonActions('cancel')}
            </Button>
            <Button tone="danger" onClick={handleBan} loading={banUser.isPending}>
              {tCommonActions('ban')}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
