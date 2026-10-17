'use client';

import { fieldBindings } from '@/components/core/bindings';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, type ReactNode } from 'react';
import { CopyButton } from '@/components/core/CopyButton';
import { useTranslations } from 'next-intl';

import type { UseFormReturnType } from '@mantine/form';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { MultiSelect, Select, Textarea, TextInput, ValidatingTextInput } from '@/components/core/Input';
import { SettingsSection } from '@/components/core/Section';
import { SocialLinksEditor } from '@/features/social-links/SocialLinksEditor';
import { useNicknameValidation, type NicknameAvailabilityCheck } from '@/features/member/useNicknameValidation';
import { UserAvatarUploader } from '@/features/user/UserAvatarUploader';
import { checkNicknameAvailabilityAction } from '@/lib/actions/user';
import { normalizeEnumToken } from '@/lib/i18n/admin-labels';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import type { SocialLinks } from '@/lib/types/common/social-links';
import type { UserFull } from '@/lib/types/user/model';

export interface AdminUserProfileFormValues {
  nickname: string;
  bio: string;
  role: string;
  tagIds: string[];
}

interface UserProfileFormSectionProps {
  user: UserFull;
  memberId: string;
  form: UseFormReturnType<AdminUserProfileFormValues>;
  website: string;
  socialLinks: SocialLinks;
  tagOptions: { value: string; label: string }[];
  onWebsiteChange: (value: string) => void;
  onSocialLinksChange: (value: SocialLinks) => void;
  onImageChange: (url: string | null) => Promise<void>;
  /** Shows recovery feedback when the clipboard rejects the member ID copy. */
  onCopyUserIdError: () => void;
  checkNickname?: NicknameAvailabilityCheck;
  /** The section's submit action; it saves only this section. */
  footer?: ReactNode;
}

export function UserProfileFormSection({
  user,
  memberId,
  form,
  website,
  socialLinks,
  tagOptions,
  onWebsiteChange,
  onSocialLinksChange,
  onImageChange,
  onCopyUserIdError,
  checkNickname = checkNicknameAvailabilityAction,
  footer,
}: UserProfileFormSectionProps) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonRoles = useTranslations('common.roles');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const tPage = useTranslations('adminUserDetail');
  const tNickname = useTranslations('nicknameField');
  const dateTime = useDateTimeFormatter();
  const checkAvailableNickname = useCallback(
    (nickname: string) =>
      nickname === user.nickname.trim() ? Promise.resolve({ available: true }) : checkNickname(nickname),
    [user.nickname, checkNickname],
  );
  const nicknameValidation = useNicknameValidation(form.values.nickname, { check: checkAvailableNickname });
  const displayLabel = user.nickname;
  const joined = user.created_at ? dateTime.date(user.created_at) : tCommonStates('unknown');
  const roleLabel =
    normalizeEnumToken(user.role) === 'admin'
      ? tCommonRoles('admin')
      : normalizeEnumToken(user.role) === 'author'
        ? tCommonRoles('author')
        : normalizeEnumToken(user.role) === 'user'
          ? tCommonRoles('user')
          : user.role;

  return (
    <SettingsSection title={tCommonLabels('profile')} description={tPage('profile.description')}>
      <DsLayoutInline align="center" gap="sm">
        <UserAvatarUploader
          memberId={memberId}
          currentImage={user.image}
          userName={user.nickname}
          size={56}
          onImageChange={onImageChange}
        />
        <DsLayoutStack gap="xxs">
          <DsText size="sm" weight="medium">
            {displayLabel}
          </DsText>
          {user.email ? (
            <DsText size="xs" tone="secondary">
              {user.email}
            </DsText>
          ) : null}
          <DsLayoutInline gap="xs">
            <LabelBadge tone="neutral" size="sm">
              {roleLabel}
            </LabelBadge>
            {user.banned ? (
              <StatusBadge tone="danger" size="sm">
                {tCommonStatuses('banned')}
              </StatusBadge>
            ) : null}
            {!user.onboarded ? (
              <StatusBadge tone="neutral" size="sm">
                {tCommonStatuses('onboardingPending')}
              </StatusBadge>
            ) : null}
          </DsLayoutInline>
        </DsLayoutStack>
      </DsLayoutInline>

      <ValidatingTextInput
        id="admin-member-nickname"
        label={tNickname('label')}
        placeholder={tNickname('placeholder')}
        autoComplete="nickname"
        value={form.values.nickname}
        onChange={(event) => form.setFieldValue('nickname', event.currentTarget.value)}
        required
        status={
          nicknameValidation.status === 'available'
            ? 'valid'
            : nicknameValidation.status === 'unavailable' || nicknameValidation.status === 'invalid'
              ? 'invalid'
              : nicknameValidation.status
        }
        description={
          nicknameValidation.status === 'checking'
            ? tNickname('checking')
            : nicknameValidation.status === 'available'
              ? tNickname('available')
              : undefined
        }
        error={
          nicknameValidation.status === 'unavailable'
            ? tNickname('unavailable')
            : nicknameValidation.status === 'invalid'
              ? tNickname('invalid')
              : nicknameValidation.status === 'error'
                ? tNickname('checkFailed')
                : undefined
        }
      />

      <DsLayoutGrid columns={{ base: 1, sm: 2 }}>
        <Select
          label={tCommonLabels('role')}
          data={[
            { value: 'user', label: tCommonRoles('user') },
            { value: 'author', label: tCommonRoles('author') },
            { value: 'admin', label: tCommonRoles('admin') },
          ]}
          {...fieldBindings(form.getInputProps('role'))}
        />

        <TextInput textRole="code" label={tCommonLabels('joined')} value={joined} readOnly />
      </DsLayoutGrid>

      <MultiSelect
        label={tCommonLabels('tags')}
        placeholder={tCommon('placeholders.searchTags')}
        data={tagOptions}
        searchable
        clearable
        {...fieldBindings(form.getInputProps('tagIds'))}
      />

      <TextInput
        textRole="code"
        label={tPage('labels.memberId')}
        value={user.id ?? memberId}
        readOnly
        rightSection={
          <CopyButton
            size="sm"
            value={user.id ?? memberId}
            label={tPage('actions.copyUuid')}
            copiedLabel={tPage('notifications.userIdCopied')}
            onCopyError={onCopyUserIdError}
          />
        }
      />

      <Textarea
        label={
          <DsLayoutInline justify="between">
            <DsText size="sm" weight="medium">
              {tCommonLabels('bio')}
            </DsText>
            <DsText size="xs" tone="secondary">
              {form.values.bio.length}/500
            </DsText>
          </DsLayoutInline>
        }
        placeholder={tPage('placeholders.bio')}
        minRows={3}
        maxRows={6}
        maxLength={500}
        autosize
        {...fieldBindings(form.getInputProps('bio'))}
      />

      <TextInput
        textRole="code"
        label={tCommonLabels('website')}
        placeholder={tCommon('placeholders.exampleUrl')}
        value={website}
        onChange={(event) => onWebsiteChange(event.currentTarget.value)}
      />

      <SocialLinksEditor value={socialLinks} onChange={onSocialLinksChange} addButtonMode="icon" />
      {footer}
    </SettingsSection>
  );
}
