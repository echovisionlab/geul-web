// =============================================================================
// Import UploadType from proto for use in mappings
// =============================================================================

import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';

/**
 * Upload Constraint Type Definitions
 *
 * This module defines the types for the dynamic file upload constraint system.
 * All upload constraints are stored in site_setting and can be modified by admins.
 */

// Re-export proto enums as SSOT
export { UploadType, FileDerivativeType } from '@echovisionlab/geul-proto/secure/file_pb.ts';

// =============================================================================
// MIME Type Constants (Static, defined in code)
// =============================================================================

/** Image MIME types */
export const IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
] as const;

/** HEIC/HEIF source formats accepted only when the client normalizes them first. */
export const HEIC_INPUT_MIME_TYPES = [
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
] as const;

/** Video MIME types */
export const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
] as const;

/** Audio MIME types */
export const AUDIO_MIME_TYPES = [
  'audio/mpeg', // .mp3
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'audio/mp4', // .m4a
  'audio/aiff', // .aif/.aiff
  'audio/x-aiff',
] as const;

/** Document MIME types */
const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const;

/** Archive MIME types */
const ARCHIVE_MIME_TYPES = ['application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'] as const;

/** 3D asset MIME types */
export const MESH_MIME_TYPES = ['model/gltf-binary'] as const;

/** Avatar MIME types (basic images only) */
export const AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;

/** Site asset MIME types */
const SITE_ASSET_MIME_TYPES = [
  'image/jpeg',
  'image/svg+xml',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/x-icon',
  'image/vnd.microsoft.icon',
] as const;

/** MIME type → extension mapping */
export const MIME_TO_EXTENSION: Record<string, string> = {
  // Images
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/heic-sequence': 'heic',
  'image/heif-sequence': 'heif',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  // Videos
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  // Audio
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'audio/flac': 'flac',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/aiff': 'aiff',
  'audio/x-aiff': 'aiff',
  // Documents
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  // Archives
  'application/zip': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/x-7z-compressed': '7z',
  // 3D assets
  'model/gltf-binary': 'glb',
};

/** Extension → MIME type mapping */
export const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  weba: 'audio/webm',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  zip: 'application/zip',
  rar: 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  glb: 'model/gltf-binary',
};

// =============================================================================
// Upload Domain (Static, defined in code)
// =============================================================================

/** Upload domain - defines the possible MIME types for each category */
export type UploadDomain = 'attachment' | 'image' | 'avatar' | 'video' | 'audio' | 'mesh' | 'siteAsset';

/** Domain → available MIME types mapping (static, cannot be changed) */
export const DOMAIN_AVAILABLE_MIMES: Record<UploadDomain, readonly string[]> = {
  attachment: [
    ...IMAGE_MIME_TYPES,
    ...VIDEO_MIME_TYPES,
    ...AUDIO_MIME_TYPES,
    ...DOCUMENT_MIME_TYPES,
    ...ARCHIVE_MIME_TYPES,
  ],
  image: IMAGE_MIME_TYPES,
  avatar: AVATAR_MIME_TYPES,
  video: VIDEO_MIME_TYPES,
  audio: AUDIO_MIME_TYPES,
  mesh: MESH_MIME_TYPES,
  siteAsset: SITE_ASSET_MIME_TYPES,
};

/** Upload type → domain mapping (static, cannot be changed) */
export const UPLOAD_TYPE_DOMAIN: Record<UploadType, UploadDomain> = {
  [UploadType.UNSPECIFIED]: 'attachment',
  [UploadType.GENERAL_FILE]: 'attachment',
  [UploadType.EDITOR_ATTACHMENT]: 'attachment',
  [UploadType.EDITOR_IMAGE]: 'image',
  [UploadType.EDITOR_VIDEO]: 'video',
  [UploadType.EDITOR_AUDIO]: 'audio',
  [UploadType.EDITOR_MESH]: 'mesh',
  [UploadType.FEATURED_IMAGE]: 'image',
  [UploadType.WORK_FEATURED_IMAGE]: 'image',
  [UploadType.SERIES_FEATURED_IMAGE]: 'image',
  [UploadType.FORM_FEATURED_IMAGE]: 'image',
  [UploadType.PROGRAM_EVENT_POSTER]: 'image',
  [UploadType.MAP_IMAGE]: 'image',
  [UploadType.RELEASE_ARTWORK]: 'image',
  [UploadType.TRACK_AUDIO]: 'audio',
  [UploadType.ARTIST_IMAGE]: 'avatar',
  [UploadType.USER_AVATAR]: 'avatar',
  [UploadType.LABEL_IMAGE]: 'image',
  [UploadType.CLIENT_LOGO]: 'image',
  [UploadType.SITE_LOGO]: 'siteAsset',
  [UploadType.SITE_FAVICON]: 'siteAsset',
  [UploadType.SITE_LOADER]: 'siteAsset',
  [UploadType.SITE_OG_BACKGROUND]: 'siteAsset',
};

// =============================================================================
// Type Guards (avoid `as` type assertions)
// =============================================================================

/** Sets for O(1) lookup in type guards */
const IMAGE_MIME_SET: ReadonlySet<string> = new Set(IMAGE_MIME_TYPES);
const HEIC_INPUT_MIME_SET: ReadonlySet<string> = new Set(HEIC_INPUT_MIME_TYPES);
const VIDEO_MIME_SET: ReadonlySet<string> = new Set(VIDEO_MIME_TYPES);
const AUDIO_MIME_SET: ReadonlySet<string> = new Set(AUDIO_MIME_TYPES);

/** Type guard for image MIME types */
export function isImageMime(mime: string): mime is (typeof IMAGE_MIME_TYPES)[number] {
  return IMAGE_MIME_SET.has(mime);
}

export function isHeicInputMime(mime: string): mime is (typeof HEIC_INPUT_MIME_TYPES)[number] {
  return HEIC_INPUT_MIME_SET.has(mime);
}

/** Type guard for video MIME types */
export function isVideoMime(mime: string): mime is (typeof VIDEO_MIME_TYPES)[number] {
  return VIDEO_MIME_SET.has(mime);
}

/** Type guard for audio MIME types */
export function isAudioMime(mime: string): mime is (typeof AUDIO_MIME_TYPES)[number] {
  return AUDIO_MIME_SET.has(mime);
}

/** Type guard for upload types */
export function isUploadType(value: number): value is UploadType {
  return value in UploadType && value !== UploadType.UNSPECIFIED;
}

// =============================================================================
// Entity Type Mappings
// =============================================================================

/** Site asset type → upload type mapping */
export type SiteAssetType =
  | 'logo_light'
  | 'logo_dark'
  | 'logo_email'
  | 'favicon'
  | 'loader'
  | 'site_og_background'
  | 'privacy_og_background'
  | 'terms_og_background';

export const SITE_ASSET_TO_UPLOAD_TYPE: Record<SiteAssetType, UploadType> = {
  logo_light: UploadType.SITE_LOGO,
  logo_dark: UploadType.SITE_LOGO,
  logo_email: UploadType.SITE_LOGO,
  favicon: UploadType.SITE_FAVICON,
  loader: UploadType.SITE_LOADER,
  site_og_background: UploadType.SITE_OG_BACKGROUND,
  privacy_og_background: UploadType.SITE_OG_BACKGROUND,
  terms_og_background: UploadType.SITE_OG_BACKGROUND,
};

/**
 * Legacy file entity type (post/page/work)
 * - Uses entity-specific attachment APIs backed by File authority
 * - S3 path: `{type}s/{entityId}/{fileId}.{ext}`
 */
export type LegacyFileEntityType = 'post' | 'page' | 'work';

/**
 * Generic file entity type
 * - Uses generic `file` DB table
 * - S3 path: `{type}s/{entityId}/{fileId}.{ext}`
 */
export type GenericFileEntityType = 'user' | 'artist' | 'label' | 'client' | 'release';

/** All file entity types that can store files */
export type FileEntityType = LegacyFileEntityType | GenericFileEntityType;

/**
 * Type guard for legacy entity-specific attachment APIs
 * Note: S3 path pattern is unified; this is for API selection only
 */
export function isLegacyFileEntityType(type: FileEntityType): type is LegacyFileEntityType {
  return type === 'post' || type === 'page' || type === 'work';
}

/**
 * Type guard for generic file entity types (uses generic `file` DB table)
 * Note: S3 path pattern is unified; this is for DB table selection only
 */
export function isGenericFileEntityType(type: FileEntityType): type is GenericFileEntityType {
  return type === 'user' || type === 'artist' || type === 'label' || type === 'client' || type === 'release';
}

/** Entity type to upload type mapping for generic entities */
export const GENERIC_ENTITY_UPLOAD_TYPE: Record<GenericFileEntityType, UploadType> = {
  user: UploadType.USER_AVATAR,
  artist: UploadType.ARTIST_IMAGE,
  label: UploadType.LABEL_IMAGE,
  client: UploadType.CLIENT_LOGO,
  release: UploadType.FEATURED_IMAGE, // Release artworks use featuredImage constraints
};
