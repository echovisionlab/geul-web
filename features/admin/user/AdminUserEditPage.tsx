'use client';
import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useEffect, useRef, useState } from 'react';
import { Code } from '@connectrpc/connect';
import { useRouter } from 'next/navigation';
import { IconBan, IconCheck } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ContentModal, DialogActions } from '@/components/core/Modal';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { Alert } from '@/components/core/Alert';
import { Button, SaveButton } from '@/components/core/Button';
import { DateTime } from '@/features/date-time/DateTime';
import { EditorHeader } from '@/features/editor/EditorHeader';
import { Select, TextInput } from '@/components/core/Input';
import { PageLoader } from '@/features/site/PageLoader';
import { UserBanStateSection, UserDeliveryEmailSection, UserSsoProvidersSection } from '@/features/admin/user/auth';
import { UserProfileFormSection, type AdminUserProfileFormValues } from '@/features/admin/user/UserProfileFormSection';
import { adminMemberName } from '@/features/admin/user/member-name';
import {
  PersonalAccessTokenSettings,
  type PersonalAccessTokenBindings,
} from '@/features/my/PersonalAccessTokenSettings';
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
import type { ActionErrorCode } from '@/lib/actions/action-result';
import { listAllUserTagsAction } from '@/lib/actions/user-tag';
import type { SocialLinks } from '@/lib/types/common/social-links';
import type { NicknameAvailabilityCheck } from '@/features/member/useNicknameValidation';
import { guardNotFound } from '@/lib/utils/not-found-guard';
import {
  buildAdminUserProfileChanges,
  shouldAdoptServerProfile,
  type AdminUserProfileChanges,
  type AdminUserProfileSnapshot,
} from './admin-user-profile';

export interface AdminUserEditPageBindings {
  getUserAdminAction: typeof getUserAdminAction;
  listAllUserTagsAction: typeof listAllUserTagsAction;
  getEmailSuppressionAction: typeof getEmailSuppressionAction;
  listAccountPersonalAccessTokensAction: typeof listAccountPersonalAccessTokensAction;
  updateUserAction: typeof updateUserAction;
  banUserAction: typeof banUserAction;
  unbanUserAction: typeof unbanUserAction;
  setUserCanonicalEmailAction: typeof setUserCanonicalEmailAction;
  removeUserSsoProviderAction: typeof removeUserSsoProviderAction;
  releaseEmailSuppressionAction: typeof releaseEmailSuppressionAction;
}
const defaultBindings: AdminUserEditPageBindings = {
  getUserAdminAction,
  listAllUserTagsAction,
  getEmailSuppressionAction,
  listAccountPersonalAccessTokensAction,
  updateUserAction,
  banUserAction,
  unbanUserAction,
  setUserCanonicalEmailAction,
  removeUserSsoProviderAction,
  releaseEmailSuppressionAction,
};
export default function AdminUserEditPage({
  id,
  bindings = defaultBindings,
  navigate,
  tokenBindings,
  checkNickname,
}: {
  id: string;
  bindings?: AdminUserEditPageBindings;
  tokenBindings?: PersonalAccessTokenBindings;
  checkNickname?: NicknameAvailabilityCheck;
  navigate?: (href: string) => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonActions = useTranslations('common.actions');
  const tPage = useTranslations('adminUserDetail');
  const tSecurityEmail = useTranslations('security.email');
  const tNickname = useTranslations('nicknameField');
  const userQuery = useQuery({
    queryKey: ['users', 'admin', id],
    queryFn: () => bindings.getUserAdminAction(id).then(unwrapQueryResult),
  });
  const { data: user, isLoading } = userQuery;
  const userRef = useRef(user);
  userRef.current = user;
  const savedUserSnapshotRef = useRef<typeof user | null>(null);
  const memberTagsQuery = useQuery({
    queryKey: ['memberTags', 'admin', 'all'],
    queryFn: () => bindings.listAllUserTagsAction().then(unwrapQueryResult),
  });
  const { data: memberTags = [] } = memberTagsQuery;
  const emailSuppressionQuery = useQuery({
    queryKey: ['emailSuppression', user?.email],
    queryFn: () => bindings.getEmailSuppressionAction(user?.email ?? '').then(unwrapQueryResult),
    enabled: Boolean(user?.email),
  });
  const { data: emailSuppression, isLoading: isSuppressionLoading } = emailSuppressionQuery;
  const { data: personalAccessTokens, isLoading: arePersonalAccessTokensLoading } = useQuery({
    queryKey: ['personalAccessToken', 'admin', id],
    queryFn: () => bindings.listAccountPersonalAccessTokensAction(id),
  });

  const [banModalOpened, { open: openBanModal, close: closeBanModal }] = useDisclosure(false);
  const [banReason, setBanReason] = useState('');
  const [banDuration, setBanDuration] = useState<string | null>('permanent');
  const [website, setWebsite] = useState('');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>({});
  const profileBaselineRef = useRef<AdminUserProfileSnapshot | null>(null);
  const form = useForm<AdminUserProfileFormValues>({
    initialValues: {
      nickname: '',
      bio: '',
      role: 'user',
      tagIds: [],
    },
  });
  const formRef = useRef(form);
  formRef.current = form;
  const invalidateUserQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['users', 'admin', id] });
    queryClient.invalidateQueries({ queryKey: ['users', 'admin', 'list'] });
  };

  const updateUser = useMutation({
    mutationFn: (data: AdminUserProfileChanges) =>
      bindings.updateUserAction(data.id, {
        ...data,
        social_links: data.socialLinks,
        tag_ids: data.tagIds,
      }),
    onSuccess: (result, variables) => {
      if (result.error) {
        notifications.show({ message: profileUpdateErrorMessage(result.errorCode), tone: 'danger' });
        return;
      }
      const currentBaseline = profileBaselineRef.current;
      if (currentBaseline) {
        const nextBaseline = { ...currentBaseline };
        if (variables.nickname !== undefined) {
          nextBaseline.nickname = variables.nickname;
        }
        if (variables.bio !== undefined) {
          nextBaseline.bio = variables.bio ?? '';
        }
        if (variables.role !== undefined) {
          nextBaseline.role = variables.role;
        }
        if (variables.tagIds !== undefined) {
          nextBaseline.tagIds = variables.tagIds;
        }
        if (variables.website !== undefined) {
          nextBaseline.website = variables.website ?? '';
        }
        if (variables.socialLinks !== undefined) {
          nextBaseline.socialLinks = variables.socialLinks ?? {};
        }
        profileBaselineRef.current = nextBaseline;
        const nextFormValues = {
          nickname: nextBaseline.nickname,
          bio: nextBaseline.bio,
          role: nextBaseline.role,
          tagIds: nextBaseline.tagIds,
        };
        formRef.current.setInitialValues(nextFormValues);
        formRef.current.resetDirty(nextFormValues);
      }
      savedUserSnapshotRef.current = userRef.current;
      notifications.show({ message: tPage('notifications.updated'), tone: 'positive' });
      invalidateUserQueries();
    },
    onError: () => {
      notifications.show({ message: profileUpdateErrorMessage(undefined), tone: 'danger' });
    },
  });

  // Server text such as "member not found: <id>" is for logs; admins see the localized reason.
  function profileUpdateErrorMessage(errorCode: ActionErrorCode | undefined): string {
    switch (errorCode) {
      case Code.AlreadyExists:
        return tNickname('unavailable');
      case Code.InvalidArgument:
        return tNickname('invalid');
      // A deleted or missing Member cannot be edited.
      case Code.NotFound:
        return tCommon('errors.entityNotFound', { entity: tCommon('entities.member') });
      default:
        return tCommon('notifications.saveFailed');
    }
  }

  const banUser = useMutation({
    mutationFn: (data: { id: string; reason?: string; banExpiresIn?: number }) =>
      bindings.banUserAction(data.id, data.reason, data.banExpiresIn),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.banned'), tone: 'positive' });
      invalidateUserQueries();
      closeBanModal();
      setBanReason('');
      setBanDuration('permanent');
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const unbanUser = useMutation({
    mutationFn: (data: { id: string }) => bindings.unbanUserAction(data.id),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.unbanned'), tone: 'positive' });
      invalidateUserQueries();
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const setCanonicalEmail = useMutation({
    mutationFn: (email: string) => bindings.setUserCanonicalEmailAction(id, email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tSecurityEmail('canonicalUpdated'), tone: 'positive' });
      invalidateUserQueries();
      queryClient.invalidateQueries({ queryKey: ['emailSuppression'] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const removeSsoProvider = useMutation({
    mutationFn: (data: { provider: string; identifier: string }) =>
      bindings.removeUserSsoProviderAction(id, data.provider, data.identifier),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({ message: tPage('notifications.ssoProviderRemoved'), tone: 'positive' });
      invalidateUserQueries();
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  const releaseSuppression = useMutation({
    mutationFn: (email: string) => bindings.releaseEmailSuppressionAction(email),
    onSuccess: (result) => {
      if (result.error) {
        notifications.show({ message: result.error, tone: 'danger' });
        return;
      }
      notifications.show({
        message: tPage('notifications.emailSuppressionReleased'),
        tone: 'positive',
      });
      queryClient.invalidateQueries({ queryKey: ['emailSuppression', user?.email] });
    },
    onError: (error) => {
      notifications.show({ message: error.message, tone: 'danger' });
    },
  });

  useEffect(() => {
    if (
      !user ||
      !shouldAdoptServerProfile({
        user,
        isSaving: updateUser.isPending,
        savedSnapshot: savedUserSnapshotRef.current,
        baseline: profileBaselineRef.current,
        isFormDirty: formRef.current.isDirty(),
        website,
        socialLinks,
      })
    ) {
      return;
    }
    savedUserSnapshotRef.current = null;

    const nextBaseline: AdminUserProfileSnapshot = {
      nickname: user.nickname,
      bio: user.bio ?? '',
      role: user.role ?? 'user',
      tagIds: user.tag_ids,
      website: user.website ?? '',
      socialLinks: user.social_links ?? {},
    };
    const nextFormValues = {
      nickname: nextBaseline.nickname,
      bio: nextBaseline.bio,
      role: nextBaseline.role,
      tagIds: nextBaseline.tagIds,
    };
    profileBaselineRef.current = nextBaseline;
    formRef.current.setInitialValues(nextFormValues);
    formRef.current.setValues(nextFormValues);
    formRef.current.resetDirty(nextFormValues);
    setWebsite(nextBaseline.website);
    setSocialLinks(nextBaseline.socialLinks);
  }, [user, updateUser.isPending, website, socialLinks]);

  if (isLoading) {
    return <PageLoader />;
  }

  if (userQuery.isError && !user) {
    return <QueryErrorAlert queries={[userQuery]} />;
  }

  guardNotFound(user);

  const isDeleted = user.status === 'deleted';

  const handleSubmit = form.onSubmit((values) => {
    const baseline = profileBaselineRef.current;
    // Enter in a field submits again while the first save is in flight; that produced duplicate errors.
    if (!baseline || isDeleted || updateUser.isPending) {
      return;
    }

    const changes = buildAdminUserProfileChanges({
      id,
      values,
      isDirty: (path) => form.isDirty(path),
      baseline,
      website,
      socialLinks,
    });
    if (changes) {
      updateUser.mutate(changes);
    }
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

  const handleCopyUserIdError = () => {
    notifications.show({ message: tPage('notifications.userIdCopyFailed'), tone: 'danger' });
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
    <DsLayoutStack>
      <QueryErrorAlert queries={[userQuery, memberTagsQuery, emailSuppressionQuery]} />
      <EditorHeader
        title={user ? adminMemberName(user, tCommon('labels.nicknameNotSet')) : tCommon('entities.member')}
        isConnected
        isSynced
        hideConnectionStatus
        hideStatus
        onBack={() => (navigate ?? router.push)('/admin/users')}
        backTooltip={tCommonActions('back')}
      />

      {user?.banned && (
        <Alert tone="danger" title={tPage('alerts.bannedTitle')}>
          <DsLayoutStack gap="xs">
            {user.ban_reason && (
              <DsText size="sm">
                {tPage('alerts.reasonLabel')}: {user.ban_reason}
              </DsText>
            )}
            {user.ban_expires ? (
              <DsText size="sm">
                {tPage('alerts.expiresLabel')}: <DateTime value={user.ban_expires} display="dateTime" />
              </DsText>
            ) : (
              <DsText size="sm">
                {tCommonLabels('duration')}: {tPage('durations.permanent')}
              </DsText>
            )}
            <Button
              size="xs"
              tone="positive"
              leftSection={<IconCheck size={14} />}
              onClick={() => unbanUser.mutate({ id })}
              loading={unbanUser.isPending}
            >
              {tCommonActions('unban')}
            </Button>
          </DsLayoutStack>
        </Alert>
      )}

      {isDeleted ? <Alert tone="neutral">{tPage('deletedNotice')}</Alert> : null}

      <DsLayoutStack gap="xl">
        <form id="admin-user-profile-form" onSubmit={handleSubmit}>
          <UserProfileFormSection
            checkNickname={checkNickname}
            user={user}
            memberId={id}
            form={form}
            website={website}
            socialLinks={socialLinks}
            tagOptions={memberTags.map((tag) => ({ value: tag.id, label: tag.name }))}
            onWebsiteChange={setWebsite}
            onSocialLinksChange={setSocialLinks}
            onImageChange={handleImageChange}
            onCopyUserIdError={handleCopyUserIdError}
            footer={
              <DsLayoutInline justify="end">
                <SaveButton type="submit" loading={updateUser.isPending} disabled={isDeleted}>
                  {tCommonActions('save')}
                </SaveButton>
              </DsLayoutInline>
            }
          />
        </form>

        <UserSsoProvidersSection
          auth={user.auth_details}
          onRemoveProvider={handleRemoveSsoProvider}
          isRemoveProviderPending={removeSsoProvider.isPending}
        />
        <UserDeliveryEmailSection
          user={user}
          suppression={emailSuppression}
          isSuppressionLoading={isSuppressionLoading}
          isReleasePending={releaseSuppression.isPending}
          onReleaseSuppression={(email) => releaseSuppression.mutate(email)}
          onSetCanonicalEmail={handleSetCanonicalEmail}
          isSetCanonicalEmailPending={setCanonicalEmail.isPending}
        />
        <UserBanStateSection
          user={user}
          actions={
            user?.role !== 'admin' && !user?.banned ? (
              <Button
                type="button"
                tone="danger"
                emphasis="medium"
                leftSection={<IconBan size={16} />}
                onClick={openBanModal}
              >
                {tCommonActions('ban')}
              </Button>
            ) : null
          }
        />
        {!arePersonalAccessTokensLoading ? (
          <DsLayoutStack as="section" gap="lg">
            <PersonalAccessTokenSettings
              subjectId={id}
              bindings={tokenBindings}
              mode="admin"
              initialPersonalAccessTokens={projectPersonalAccessTokensForSettings(
                personalAccessTokens?.personalAccessTokens ?? [],
              )}
              initialLoadFailed={Boolean(personalAccessTokens?.error)}
            />
          </DsLayoutStack>
        ) : null}
      </DsLayoutStack>

      <ContentModal
        closeLabel={tCommonActions('close')}
        loading={banUser.isPending}
        opened={banModalOpened}
        onClose={closeBanModal}
        title={tPage('modal.title')}
      >
        <DsLayoutStack>
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
          <DialogActions>
            <Button emphasis="low" onClick={closeBanModal}>
              {tCommonActions('cancel')}
            </Button>
            <Button tone="danger" emphasis="strong" onClick={handleBan} loading={banUser.isPending}>
              {tCommonActions('ban')}
            </Button>
          </DialogActions>
        </DsLayoutStack>
      </ContentModal>
    </DsLayoutStack>
  );
}
