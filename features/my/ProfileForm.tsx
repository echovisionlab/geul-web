'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useClipboard } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  ProfileFormView,
  type ProfileFormViewErrors,
  type ProfileFormValues,
  type ProfileSocialPlatformOption,
} from '@/features/my/ui/ProfileForm';
import { useNicknameValidation } from '@/features/member/useNicknameValidation';
import { updateProfileAction } from '@/lib/actions/user';
import { useSession } from '@/lib/auth/client';
import { PLATFORM_CONFIGS, SOCIAL_PLATFORMS, type SocialLinks } from '@/lib/types/common/social-links';
import {
  formatOrderedLinksForSave,
  isValidPlatform,
  normalizeToUrl,
  toEditableOrderedArray,
} from '@/lib/utils/social-links';

const SOCIAL_PLATFORM_OPTIONS: ProfileSocialPlatformOption[] = SOCIAL_PLATFORMS.map((platform) => ({
  value: platform,
  label: PLATFORM_CONFIGS[platform].label,
  placeholder: PLATFORM_CONFIGS[platform].placeholder,
}));

interface ProfileFormProps {
  initialUser: {
    id: string;
    nickname: string;
    role: string | null;
    bio: string | null;
    website: string | null;
    socialLinks: SocialLinks | null;
  };
  disabled?: boolean;
}

/** Connects profile translations and persistence to the pure profile form view. */
export function ProfileForm({ initialUser, disabled = false }: ProfileFormProps) {
  const t = useTranslations('profile');
  const tCommon = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const tSocialLinks = useTranslations('socialLinks');
  const tNickname = useTranslations('nicknameField');
  const { updateMemberSummary } = useSession();
  const { copied, copy } = useClipboard({ timeout: 2000 });
  const [errors, setErrors] = useState<ProfileFormViewErrors>({});
  const [nickname, setNickname] = useState(initialUser.nickname);
  const nicknameValidation = useNicknameValidation(nickname);

  const showUpdateError = (message: string, field: 'form' | 'nickname' = 'form') => {
    setErrors({ [field]: message });
    notifications.show({
      title: tCommonLabels('error'),
      message,
      color: 'red',
    });
  };

  const updateProfileMutation = useMutation({
    mutationFn: updateProfileAction,
    onSuccess: async (result) => {
      if (result.error) {
        showUpdateError(
          result.errorCode === 'nickname_unavailable'
            ? tNickname('unavailable')
            : result.errorCode === 'nickname_invalid'
              ? tNickname('invalid')
              : result.error,
          result.errorCode ? 'nickname' : 'form',
        );
        return;
      }

      setErrors({});
      notifications.show({
        title: t('notifications.successTitle'),
        message: t('notifications.updated'),
        color: 'green',
      });
      if (result.member) {
        updateMemberSummary(result.member);
      }
    },
    onError: (error) => {
      showUpdateError(error instanceof Error ? error.message : String(error));
    },
  });

  const isAuthorOrAdmin = initialUser.role === 'admin' || initialUser.role === 'author';
  const initialSocialLinks = toEditableOrderedArray(initialUser.socialLinks ?? {}).map(
    ({ key, platform, value }, index) => ({
      key: key || `stored-${index}`,
      platform,
      value,
    }),
  );

  const handleUpdateProfile = (values: ProfileFormValues) => {
    setErrors({});
    if (!nicknameValidation.valid || nicknameValidation.status === 'unavailable') {
      showUpdateError(
        nicknameValidation.status === 'unavailable' ? tNickname('unavailable') : tNickname('invalid'),
        'nickname',
      );
      return;
    }
    updateProfileMutation.mutate({
      nickname: nicknameValidation.normalized,
      ...(isAuthorOrAdmin && {
        bio: values.bio || null,
        website: values.website || null,
        social_links: formatOrderedLinksForSave(values.socialLinks),
      }),
    });
  };

  return (
    <ProfileFormView
      key={initialUser.id}
      initialValues={{
        uid: initialUser.id,
        nickname: initialUser.nickname,
        bio: initialUser.bio ?? '',
        website: initialUser.website ?? '',
        socialLinks: initialSocialLinks,
      }}
      labels={{
        uid: t('fields.uid'),
        copyUid: tCommon('copy'),
        copiedUid: tCommon('copied'),
        nickname: tNickname('label'),
        nicknamePlaceholder: tNickname('placeholder'),
        bio: t('fields.bio'),
        bioPlaceholder: t('placeholders.bio'),
        website: tCommonLabels('website'),
        websitePlaceholder: tCommonPlaceholders('exampleUrl'),
        socialLinks: tSocialLinks('label'),
        addSocialLink: tSocialLinks('addLink'),
        socialPlatform: tSocialLinks('platformPlaceholder'),
        socialValue: tSocialLinks('valuePlaceholder'),
        removeSocialLink: (position) => `${tCommon('remove')} ${tSocialLinks('label')} ${position}`,
        reorderSocialLink: (position) => `${tCommon('change')} ${tSocialLinks('label')} ${position}`,
        submit: t('actions.update'),
      }}
      platformOptions={SOCIAL_PLATFORM_OPTIONS}
      showExtendedFields={isAuthorOrAdmin}
      pending={updateProfileMutation.isPending}
      disabled={disabled}
      copied={copied}
      errors={errors}
      nicknameValidation={{
        status:
          nicknameValidation.status === 'available'
            ? 'valid'
            : nicknameValidation.status === 'unavailable' || nicknameValidation.status === 'invalid'
              ? 'invalid'
              : nicknameValidation.status,
        message:
          nicknameValidation.status === 'checking'
            ? tNickname('checking')
            : nicknameValidation.status === 'available'
              ? tNickname('available')
              : nicknameValidation.status === 'unavailable'
                ? tNickname('unavailable')
                : nicknameValidation.status === 'invalid'
                  ? tNickname('invalid')
                  : nicknameValidation.status === 'error'
                    ? tNickname('checkFailed')
                    : null,
      }}
      events={{
        onCopyUid: () => copy(initialUser.id),
        onNicknameChange: (value) => {
          setNickname(value);
          setErrors((current) => ({ ...current, nickname: undefined }));
        },
        onNormalizeSocialLink: (platform, value) =>
          isValidPlatform(platform) ? normalizeToUrl(platform, value) : value,
        onSubmit: handleUpdateProfile,
      }}
    />
  );
}
