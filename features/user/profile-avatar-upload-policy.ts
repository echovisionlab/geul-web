import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { toAcceptString } from '@/lib/utils/upload';
import { prepareImageFileForPreview, validateUploadSelectionFile } from '@/lib/utils/upload-pipeline';
import { getUploadSelectionMaxSize } from '@/lib/utils/upload-policy';

const config = UPLOAD_CONFIGS[UploadType.USER_AVATAR];

export const userAvatarSelectionMimeTypes = getUploadSelectionMimeTypes(UploadType.USER_AVATAR);
export const userAvatarSelectionAccept = toAcceptString(userAvatarSelectionMimeTypes).split(',');
export const userAvatarSelectionMaxSize = getUploadSelectionMaxSize(
  UploadType.USER_AVATAR,
  'image/jpeg',
  config.maxSize,
);

export function validateUserAvatarSelection(file: File) {
  const validation = validateUploadSelectionFile(file, UploadType.USER_AVATAR);
  return validation.valid ? null : validation.error;
}

export function prepareUserAvatarPreview(file: File) {
  return prepareImageFileForPreview(file, UploadType.USER_AVATAR);
}
