'use client';

import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import type { ImageUploadRejection } from '@/components/core/ImageUpload';
import {
  deleteAvatarAction,
  deleteAvatarForMemberAction,
  setAvatarAction,
  setAvatarForMemberAction,
} from '@/lib/actions/user';
import { useUpload } from '@/lib/hooks/useUpload';
import { useSession } from '@/lib/auth/client';
import { UploadType } from '@/lib/types/upload/model';
import {
  prepareUserAvatarPreview,
  userAvatarSelectionAccept,
  userAvatarSelectionMaxSize,
  validateUserAvatarSelection,
} from './profile-avatar-upload-policy';
import { PageLoader } from '@/features/site/PageLoader';
import { ProfileAvatarControl } from './ui/ProfileAvatarControl/ProfileAvatarControl';
import { useImageCropAccessibility } from '@/lib/i18n/useImageCropAccessibility';

export interface UserAvatarUploaderProps {
  memberId: string;
  currentImage: string | null | undefined;
  userName?: string | null;
  size?: number;
  isOwnProfile?: boolean;
  onImageChange?: (url: string | null) => Promise<void>;
}

/** Connects the pure profile-avatar control to upload, user, and session state. */
export function UserAvatarUploader({
  memberId,
  currentImage,
  userName,
  size,
  isOwnProfile = false,
  onImageChange,
}: UserAvatarUploaderProps) {
  const t = useTranslations('userAvatar');
  const tCommon = useTranslations('common');
  const tCommonMessages = useTranslations('common.messages');
  const cropAccessibility = useImageCropAccessibility(t('cropTitle'));
  const { upload } = useUpload(UploadType.USER_AVATAR);
  const { updateMemberSummary } = useSession();
  const setOwnAvatar = useMutation({
    mutationFn: (data: { fileId: string }) => setAvatarAction(data.fileId),
  });
  const setUserAvatar = useMutation({
    mutationFn: (data: { memberId: string; fileId: string }) => setAvatarForMemberAction(data.memberId, data.fileId),
  });
  const deleteOwnAvatar = useMutation({ mutationFn: () => deleteAvatarAction() });
  const deleteUserAvatar = useMutation({
    mutationFn: (data: { memberId: string }) => deleteAvatarForMemberAction(data.memberId),
  });

  const handleSave = useCallback(
    async (blob: Blob) => {
      try {
        const { fileId, url } = await upload(blob, {
          entityId: memberId,
          fileName: 'avatar.webp',
        });
        const result = isOwnProfile
          ? await setOwnAvatar.mutateAsync({ fileId })
          : await setUserAvatar.mutateAsync({ memberId, fileId });

        if (result.error) {
          throw new Error(result.error);
        }

        if (isOwnProfile && 'member' in result && result.member) {
          updateMemberSummary(result.member);
        }
        const savedUrl = 'url' in result ? result.url : undefined;
        await onImageChange?.(('member' in result ? result.member?.avatarUrl : savedUrl) ?? url);
        notifications.show({ message: t('updated'), tone: 'positive' });
        return true;
      } catch (error) {
        notifications.show({
          message: error instanceof Error ? error.message : tCommonMessages('uploadImageFailed'),
          tone: 'danger',
        });
        return false;
      }
    },
    [
      isOwnProfile,
      memberId,
      onImageChange,
      setOwnAvatar,
      setUserAvatar,
      t,
      tCommonMessages,
      updateMemberSummary,
      upload,
    ],
  );

  const handleRemove = useCallback(async () => {
    try {
      const result = isOwnProfile
        ? await deleteOwnAvatar.mutateAsync()
        : await deleteUserAvatar.mutateAsync({ memberId });
      if (result.error) {
        throw new Error(result.error);
      }

      if (isOwnProfile && 'member' in result && result.member) {
        updateMemberSummary(result.member);
      }
      await onImageChange?.(null);
      notifications.show({ message: t('removed'), tone: 'positive' });
      return true;
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : tCommonMessages('removeImageFailed'),
        tone: 'danger',
      });
      return false;
    }
  }, [
    deleteOwnAvatar,
    deleteUserAvatar,
    isOwnProfile,
    memberId,
    onImageChange,
    t,
    tCommonMessages,
    updateMemberSummary,
  ]);

  const showValidationError = useCallback((message: string) => {
    notifications.show({ message, tone: 'danger' });
  }, []);

  const handleRejected = useCallback(
    (rejections: ImageUploadRejection[]) => {
      const rejectedFile = rejections[0]?.file;
      showValidationError(
        (rejectedFile ? validateUserAvatarSelection(rejectedFile) : null) ?? tCommonMessages('uploadImageFailed'),
      );
    },
    [showValidationError, tCommonMessages],
  );

  const alt = userName || tCommon('entities.user');

  return (
    <ProfileAvatarControl
      key={memberId}
      imageUrl={currentImage}
      loadingSurface={<PageLoader placement="flow" minHeight={160} size="sm" />}
      size={size}
      accept={userAvatarSelectionAccept}
      maxSize={userAvatarSelectionMaxSize}
      cropAccessibility={cropAccessibility}
      labels={{
        alt,
        upload: tCommon('actions.uploadItem', { item: t('label') }),
        change: tCommon('uploadField.changeHint'),
        remove: tCommon('actions.remove'),
        cropTitle: t('cropTitle'),
        cropPreview: t('cropTitle'),
        cancel: tCommon('actions.cancel'),
        confirm: tCommon('actions.confirm'),
        preparing: tCommon('uploadField.status.preparingImage'),
        loadFailed: tCommonMessages('failedToLoad'),
        retry: tCommon('actions.tryAgain'),
      }}
      validateFile={validateUserAvatarSelection}
      prepareFile={prepareUserAvatarPreview}
      onValidationError={showValidationError}
      onValidationReject={handleRejected}
      onSave={handleSave}
      onRemove={currentImage ? handleRemove : undefined}
    />
  );
}
