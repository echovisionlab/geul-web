/**
 * Upload Configuration Constants
 *
 * Matches backend's DefaultUploadConfigs in apps/backend/internal/model/upload_config.go
 * These are static values - no API call needed.
 */

import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { getPublicEditorImageMaxSizeBytes } from '@/lib/public-runtime-config';
import { HEIC_INPUT_MIME_TYPES } from '@/lib/types/upload/model';
import { MANAGED_RASTER_FINAL_MAX_SIZE } from '@/lib/utils/upload-policy';

const DEFAULT_IMAGE_MAX_SIZE = MANAGED_RASTER_FINAL_MAX_SIZE;
const editorImageMaxSize = getPublicEditorImageMaxSizeBytes();
const STANDARD_RASTER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'] as const;
const STANDARD_RASTER_SELECTION_MIME_TYPES = [...STANDARD_RASTER_MIME_TYPES, ...HEIC_INPUT_MIME_TYPES] as const;
const EDITOR_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'] as const;
const EDITOR_IMAGE_SELECTION_MIME_TYPES = [...EDITOR_IMAGE_MIME_TYPES, ...HEIC_INPUT_MIME_TYPES] as const;
const GENERAL_FILE_MIME_TYPES = [
  ...EDITOR_IMAGE_MIME_TYPES,
  'image/svg+xml',
  'image/x-icon',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'audio/mp4',
  'audio/aiff',
  'audio/x-aiff',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'model/gltf-binary',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  'text/plain',
  'text/csv',
  'application/json',
] as const;

/** Upload configuration for client-side validation */
export interface UploadConfig {
  /** MIME types accepted by the backend after client preprocessing. */
  permittedMimeTypes: readonly string[];
  /** Additional source MIME types accepted by the file picker and normalized before upload. */
  selectionMimeTypes?: readonly string[];
  maxSize: number;
  minSize: number;
  label: string;
  description?: string;
}

/**
 * Default upload configurations matching backend.
 * SSOT: apps/backend/internal/model/upload_config.go
 */
export const UPLOAD_CONFIGS: Record<UploadType, UploadConfig> = {
  [UploadType.UNSPECIFIED]: {
    permittedMimeTypes: [],
    maxSize: 0,
    minSize: 0,
    label: 'Unspecified',
  },
  [UploadType.GENERAL_FILE]: {
    permittedMimeTypes: GENERAL_FILE_MIME_TYPES,
    maxSize: 8 * 1024 * 1024 * 1024,
    minSize: 1,
    label: 'General File',
    description: 'Standalone File Manager source',
  },
  [UploadType.USER_AVATAR]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'User Avatar',
  },
  [UploadType.ARTIST_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Artist Image',
  },
  [UploadType.EDITOR_IMAGE]: {
    permittedMimeTypes: EDITOR_IMAGE_MIME_TYPES,
    selectionMimeTypes: EDITOR_IMAGE_SELECTION_MIME_TYPES,
    maxSize: editorImageMaxSize,
    minSize: 1,
    label: 'Editor Image',
  },
  [UploadType.EDITOR_VIDEO]: {
    permittedMimeTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
    maxSize: 8 * 1024 * 1024 * 1024, // 8GB
    minSize: 1,
    label: 'Editor Video',
  },
  [UploadType.EDITOR_AUDIO]: {
    permittedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'audio/flac',
      'audio/aac',
      'audio/mp4',
      'audio/aiff',
      'audio/x-aiff',
    ],
    maxSize: 4 * 1024 * 1024 * 1024, // 4GB
    minSize: 1,
    label: 'Editor Audio',
  },
  [UploadType.EDITOR_ATTACHMENT]: {
    permittedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/x-7z-compressed',
      'text/plain',
      'text/csv',
      'application/json',
    ],
    maxSize: 500 * 1024 * 1024, // 500MB
    minSize: 1,
    label: 'Editor Attachment',
  },
  [UploadType.EDITOR_MESH]: {
    permittedMimeTypes: ['model/gltf-binary'],
    maxSize: 50 * 1024 * 1024, // 50MB
    minSize: 1,
    label: 'Editor Mesh',
  },
  [UploadType.FEATURED_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Featured Image',
  },
  [UploadType.WORK_FEATURED_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Work Featured Image',
  },
  [UploadType.SERIES_FEATURED_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Series Featured Image',
  },
  [UploadType.FORM_FEATURED_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Form Featured Image',
  },
  [UploadType.PROGRAM_EVENT_POSTER]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Event Poster',
  },
  [UploadType.MAP_IMAGE]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: MANAGED_RASTER_FINAL_MAX_SIZE,
    minSize: 1,
    label: 'Map Image',
  },
  [UploadType.RELEASE_ARTWORK]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: DEFAULT_IMAGE_MAX_SIZE,
    minSize: 1,
    label: 'Release Artwork',
  },
  [UploadType.TRACK_AUDIO]: {
    permittedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/ogg',
      'audio/mp4',
      'audio/aiff',
      'audio/x-aiff',
    ],
    maxSize: 4 * 1024 * 1024 * 1024, // 4GB
    minSize: 1,
    label: 'Track Audio',
    description: 'Original audio file for transcoding',
  },
  [UploadType.LABEL_IMAGE]: {
    permittedMimeTypes: ['image/png', 'image/webp', 'image/svg+xml'],
    selectionMimeTypes: ['image/png', 'image/webp', 'image/svg+xml', ...HEIC_INPUT_MIME_TYPES],
    maxSize: 5 * 1024 * 1024, // 5MB
    minSize: 1,
    label: 'Label Image',
  },
  [UploadType.CLIENT_LOGO]: {
    permittedMimeTypes: ['image/png', 'image/webp', 'image/svg+xml'],
    selectionMimeTypes: ['image/png', 'image/webp', 'image/svg+xml', ...HEIC_INPUT_MIME_TYPES],
    maxSize: 5 * 1024 * 1024, // 5MB
    minSize: 1,
    label: 'Client Logo',
  },
  [UploadType.SITE_LOGO]: {
    permittedMimeTypes: ['image/svg+xml', 'image/png'],
    maxSize: 2 * 1024 * 1024, // 2MB
    minSize: 1,
    label: 'Site Logo',
  },
  [UploadType.SITE_FAVICON]: {
    permittedMimeTypes: ['image/png', 'image/x-icon', 'image/svg+xml'],
    selectionMimeTypes: ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'],
    maxSize: 2 * 1024 * 1024, // 2MB
    minSize: 1,
    label: 'Site Favicon',
  },
  [UploadType.SITE_LOADER]: {
    permittedMimeTypes: ['image/gif', 'image/png', 'image/webp'],
    maxSize: 100 * 1024, // 100KB
    minSize: 1,
    label: 'Site Loader',
  },
  [UploadType.SITE_OG_BACKGROUND]: {
    permittedMimeTypes: STANDARD_RASTER_MIME_TYPES,
    selectionMimeTypes: STANDARD_RASTER_SELECTION_MIME_TYPES,
    maxSize: DEFAULT_IMAGE_MAX_SIZE,
    minSize: 1,
    label: 'Site OG Background',
  },
} as const;

export function getUploadSelectionMimeTypes(uploadType: UploadType): readonly string[] {
  const config = UPLOAD_CONFIGS[uploadType];
  return config.selectionMimeTypes ?? config.permittedMimeTypes;
}
