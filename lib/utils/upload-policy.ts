import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';

export const MANAGED_RASTER_MAX_DIMENSION = 4096;
export const MANAGED_RASTER_FINAL_MAX_SIZE = 30 * 1024 * 1024; // 30MB post-crop/post-normalization file

const MANAGED_RASTER_SELECTION_MAX_SIZE = 20 * 1024 * 1024; // 20MB original file

const MANAGED_RASTER_UPLOAD_TYPES = new Set<UploadType>([
  UploadType.USER_AVATAR,
  UploadType.ARTIST_IMAGE,
  UploadType.EDITOR_IMAGE,
  UploadType.FEATURED_IMAGE,
  UploadType.WORK_FEATURED_IMAGE,
  UploadType.SERIES_FEATURED_IMAGE,
  UploadType.FORM_FEATURED_IMAGE,
  UploadType.PROGRAM_EVENT_POSTER,
  UploadType.RELEASE_ARTWORK,
  UploadType.SITE_OG_BACKGROUND,
]);

const NORMALIZABLE_RASTER_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function isManagedRasterUploadType(uploadType: UploadType): boolean {
  return MANAGED_RASTER_UPLOAD_TYPES.has(uploadType);
}

function isNormalizableRasterMimeType(mimeType: string | null | undefined): boolean {
  return mimeType != null && NORMALIZABLE_RASTER_MIME_TYPES.has(mimeType);
}

export function shouldNormalizeManagedRasterUpload(
  uploadType: UploadType,
  mimeType: string | null | undefined,
): boolean {
  return isManagedRasterUploadType(uploadType) && isNormalizableRasterMimeType(mimeType);
}

export function getUploadSelectionMaxSize(
  uploadType: UploadType,
  mimeType: string | null | undefined,
  fallbackMaxSize: number,
): number {
  if (shouldNormalizeManagedRasterUpload(uploadType, mimeType)) {
    return Math.min(fallbackMaxSize, MANAGED_RASTER_SELECTION_MAX_SIZE);
  }

  return fallbackMaxSize;
}
