'use client';

import { useCallback } from 'react';
import { IconCopy } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { badgeToneFromColor, LabelBadge, StatusBadge } from '@/components/core/Badge';
import { IconButton } from '@/components/core/IconButton';
import { MultiSelect, Select, Textarea, TextInput, ValidatingTextInput } from '@/components/core/Input';
import { SectionHeader } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import { SocialLinksEditor } from '@/features/social-links/SocialLinksEditor';
import { useNicknameValidation } from '@/features/member/useNicknameValidation';
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
  onCopyUserId: () => void;
}

function roleTone(role: string | null | undefined) {
  const normalized = normalizeEnumToken(role);
  if (normalized === 'admin') {
    return badgeToneFromColor('red');
  }
  if (normalized === 'author') {
    return badgeToneFromColor('violet');
  }
  return badgeToneFromColor('blue');
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
  onCopyUserId,
}: UserProfileFormSectionProps) {
  const tCommon = useTranslations('common');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonRoles = useTranslations('common.roles');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const tPage = useTranslations('adminUserDetail');
  const tNickname = useTranslations('nicknameField');
  const dateTime = useDateTimeFormatter();
  const checkNickname = useCallback(
    (nickname: string) =>
      nickname === user.nickname.trim()
        ? Promise.resolve({ available: true })
        : checkNicknameAvailabilityAction(nickname),
    [user.nickname],
  );
  const nicknameValidation = useNicknameValidation(form.values.nickname, { check: checkNickname });
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
    <Stack gap="md">
      <SectionHeader title={tCommonLabels('profile')} />

      <Group align="center" gap="sm">
        <UserAvatarUploader
          memberId={memberId}
          currentImage={user.image}
          userName={user.nickname}
          size={56}
          onImageChange={onImageChange}
        />
        <Stack gap={4}>
          <Text size="sm" fw={500}>
            {displayLabel}
          </Text>
          {user.email ? (
            <Text size="xs" c="dimmed">
              {user.email}
            </Text>
          ) : null}
          <Group gap="xs">
            <LabelBadge tone={roleTone(user.role)} size="sm">
              {roleLabel}
            </LabelBadge>
            {user.banned ? (
              <StatusBadge tone="danger" size="sm">
                {tCommonStatuses('banned')}
              </StatusBadge>
            ) : null}
            {!user.onboarded ? (
              <StatusBadge tone="warning" size="sm">
                {tCommonStatuses('onboardingPending')}
              </StatusBadge>
            ) : null}
          </Group>
        </Stack>
      </Group>

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

      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <Select
          label={tCommonLabels('role')}
          data={[
            { value: 'user', label: tCommonRoles('user') },
            { value: 'author', label: tCommonRoles('author') },
            { value: 'admin', label: tCommonRoles('admin') },
          ]}
          {...form.getInputProps('role')}
        />

        <TextInput label={tCommonLabels('joined')} value={joined} readOnly />
      </SimpleGrid>

      <MultiSelect
        label={tCommonLabels('tags')}
        placeholder={tCommon('placeholders.searchTags')}
        data={tagOptions}
        searchable
        clearable
        {...form.getInputProps('tagIds')}
      />

      <TextInput
        label={tPage('labels.memberId')}
        value={user.id ?? memberId}
        readOnly
        styles={{ input: { fontFamily: 'monospace' } }}
        rightSectionPointerEvents="all"
        rightSection={
          <Tooltip label={tPage('actions.copyUuid')}>
            <IconButton emphasis="low" size="sm" onClick={onCopyUserId} aria-label={tPage('actions.copyUuid')}>
              <IconCopy size={14} />
            </IconButton>
          </Tooltip>
        }
      />

      <Textarea
        label={
          <Group justify="space-between">
            <Text size="sm" fw={500}>
              {tCommonLabels('bio')}
            </Text>
            <Text size="xs" c="dimmed">
              {form.values.bio.length}/500
            </Text>
          </Group>
        }
        labelProps={{ w: '100%' }}
        placeholder={tPage('placeholders.bio')}
        minRows={3}
        maxRows={6}
        maxLength={500}
        autosize
        {...form.getInputProps('bio')}
      />

      <TextInput
        label={tCommonLabels('website')}
        placeholder={tCommon('placeholders.exampleUrl')}
        value={website}
        onChange={(event) => onWebsiteChange(event.currentTarget.value)}
      />

      <SocialLinksEditor value={socialLinks} onChange={onSocialLinksChange} addButtonMode="icon" />
    </Stack>
  );
}
