/**
 * Upload Utility Functions
 *
 * Helper functions for working with upload constraints and validation.
 */
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS, type UploadConfig } from '@/lib/constants/upload-config';
import {
  EXTENSION_TO_MIME,
  isAudioMime,
  isHeicInputMime,
  isImageMime,
  isVideoMime,
  MIME_TO_EXTENSION,
  UploadType,
} from '@/lib/types/upload/model';
import { canonicalizeMimeType } from './mime';
import { isExternalVideoProviderUrl } from '@/lib/media/external-video';

// =============================================================================
// Upload Type Detection
// =============================================================================

/**
 * Determine UploadType from MIME type.
 * Used for editor uploads where block type determines routing.
 */
export function getUploadTypeForMime(mimeType: string): UploadType {
  const canonicalMime = canonicalizeMimeType(mimeType);
  if (isImageMime(canonicalMime) || isHeicInputMime(canonicalMime)) {
    return UploadType.EDITOR_IMAGE;
  }
  if (isVideoMime(canonicalMime)) {
    return UploadType.EDITOR_VIDEO;
  }
  if (isAudioMime(canonicalMime)) {
    return UploadType.EDITOR_AUDIO;
  }
  return UploadType.EDITOR_ATTACHMENT;
}

export interface UploadSupportSpec {
  uploadType: UploadType;
  config: UploadConfig;
  mimeTypes: readonly string[];
  extensions: string[];
}

function dedupeDisplayExtensions(mimeTypes: readonly string[]): string[] {
  const seen = new Set<string>();
  const extensions: string[] = [];

  for (const mimeType of mimeTypes) {
    const canonicalMime = canonicalizeMimeType(mimeType);
    const rawExtension =
      MIME_TO_EXTENSION[canonicalMime] ?? canonicalMime.split('/')[1]?.toLowerCase() ?? canonicalMime;
    const extension = rawExtension.toUpperCase();
    if (!extension || seen.has(extension)) {
      continue;
    }
    seen.add(extension);
    extensions.push(extension);
  }

  return extensions;
}

function dedupeMimeTypes(mimeTypes: readonly string[]): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const mimeType of mimeTypes) {
    const canonicalMime = canonicalizeMimeType(mimeType);
    if (!canonicalMime || seen.has(canonicalMime)) {
      continue;
    }
    seen.add(canonicalMime);
    deduped.push(canonicalMime);
  }

  return deduped;
}

function getUploadSupportSpec(uploadType: UploadType): UploadSupportSpec {
  const config = UPLOAD_CONFIGS[uploadType];
  const mimeTypes = dedupeMimeTypes(getUploadSelectionMimeTypes(uploadType));
  return {
    uploadType,
    config,
    mimeTypes,
    extensions: dedupeDisplayExtensions(mimeTypes),
  };
}

export function formatSupportedUploadFormats(input: UploadType | readonly string[] | readonly UploadType[]): string {
  if (Array.isArray(input)) {
    if (input.length === 0) {
      return '';
    }

    if (typeof input[0] === 'number') {
      const mimeTypes = dedupeMimeTypes(
        (input as readonly UploadType[]).flatMap((uploadType) => getUploadSelectionMimeTypes(uploadType)),
      );
      return dedupeDisplayExtensions(mimeTypes).join(', ');
    }

    return dedupeDisplayExtensions(input as readonly string[]).join(', ');
  }

  return getUploadSupportSpec(input as UploadType).extensions.join(', ');
}

export function buildUnsupportedUploadTypeMessage(
  uploadType: UploadType,
  actualType?: string,
  supportedMimeTypes: readonly string[] = getUploadSelectionMimeTypes(uploadType),
): string {
  const actualLabel = actualType?.trim();
  const supportedFormats = formatSupportedUploadFormats(supportedMimeTypes);
  const prefix = actualLabel ? `Unsupported file type (${actualLabel}).` : 'Unsupported file type.';
  return supportedFormats ? `${prefix} Supported formats: ${supportedFormats}.` : prefix;
}

export function buildUnsupportedRemoteUploadTypeMessage(uploadType: UploadType): string {
  const supportedFormats = formatSupportedUploadFormats(UPLOAD_CONFIGS[uploadType].permittedMimeTypes);
  const prefix = 'This URL appears to point to an unsupported file type.';
  return supportedFormats ? `${prefix} Supported formats: ${supportedFormats}.` : prefix;
}

export function buildUnsupportedEditorMediaMessage(actualType?: string): string {
  const supportedFormats = formatSupportedUploadFormats([
    UploadType.EDITOR_IMAGE,
    UploadType.EDITOR_VIDEO,
    UploadType.EDITOR_AUDIO,
    UploadType.EDITOR_ATTACHMENT,
  ]);
  const actualLabel = actualType?.trim();
  const prefix = actualLabel ? `Unsupported editor media type (${actualLabel}).` : 'Unsupported editor media type.';
  return supportedFormats ? `${prefix} Supported formats: ${supportedFormats}.` : prefix;
}

// =============================================================================
// MIME / Extension Conversion
// =============================================================================

/**
 * Get file extension from MIME type.
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const canonicalMime = canonicalizeMimeType(mimeType);
  return MIME_TO_EXTENSION[canonicalMime] ?? 'bin';
}

/**
 * Guess MIME type from filename extension.
 */
function guessMimeTypeFromFileName(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (!ext) {
    return '';
  }
  return EXTENSION_TO_MIME[ext] ?? '';
}

function shouldPreferFilenameMime(browserMime: string, filenameMime: string, uploadType?: UploadType): boolean {
  if (!browserMime || !filenameMime || browserMime === filenameMime) {
    return false;
  }

  if (
    uploadType === UploadType.EDITOR_MESH &&
    browserMime === 'application/octet-stream' &&
    filenameMime === 'model/gltf-binary'
  ) {
    return true;
  }

  if (isHeicInputMime(filenameMime) && !isHeicInputMime(browserMime)) {
    return true;
  }

  // Audio MIME metadata is not reliable across browsers/OSes; e.g. some AIFF
  // selections arrive from the file input as audio/mpeg. Prefer an explicit
  // audio extension so the upload declaration matches the user's file.
  return isAudioMime(browserMime) && isAudioMime(filenameMime);
}

/**
 * Resolve best-effort canonical MIME for upload.
 *
 * Priority:
 * 1) filename extension when it corrects a known browser MIME mismatch
 * 2) browser-provided file.type
 * 3) filename extension fallback
 */
export function resolveUploadMimeType(file: Pick<File, 'name' | 'type'>, uploadType?: UploadType): string {
  const canonicalFromType = canonicalizeMimeType(file.type);
  const canonicalFromName = canonicalizeMimeType(guessMimeTypeFromFileName(file.name));
  if (shouldPreferFilenameMime(canonicalFromType, canonicalFromName, uploadType)) {
    return canonicalFromName;
  }
  if (canonicalFromType) {
    return canonicalFromType;
  }
  return canonicalFromName;
}

/**
 * Resolve best-effort canonical MIME from a remote URL path.
 *
 * Returns an empty string when the URL has no useful filename extension.
 */
export function resolveUploadMimeTypeFromUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl, typeof window !== 'undefined' ? window.location.origin : 'https://app.invalid');
    const fileName = parsed.pathname.split('/').filter(Boolean).pop();
    if (!fileName) {
      return '';
    }

    const ext = fileName.split('.').pop()?.toLowerCase();
    if (!ext) {
      return '';
    }

    return canonicalizeMimeType(EXTENSION_TO_MIME[ext] ?? '');
  } catch {
    const fileName = rawUrl.split('/').filter(Boolean).pop();
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (!ext) {
      return '';
    }
    return canonicalizeMimeType(EXTENSION_TO_MIME[ext] ?? '');
  }
}

/**
 * Frontend-only preflight for obvious remote URL mismatches.
 *
 * - `true`: URL extension clearly matches an allowed MIME type
 * - `false`: URL extension clearly maps to a disallowed MIME type
 * - `null`: URL doesn't provide enough information; let the server decide
 */
export function isLikelySupportedUploadUrl(rawUrl: string, permittedMimeTypes: readonly string[]): boolean | null {
  if (isExternalVideoProviderUrl(rawUrl)) {
    return false;
  }
  try {
    if (/\.m3u8$/i.test(new URL(rawUrl).pathname)) {
      return false;
    }
  } catch {
    // Existing URL validation reports malformed URLs.
  }
  const guessedMime = resolveUploadMimeTypeFromUrl(rawUrl);
  if (!guessedMime) {
    return null;
  }

  const allowed = new Set(permittedMimeTypes.map((mime) => canonicalizeMimeType(mime)));
  return allowed.has(guessedMime);
}

// =============================================================================
// Formatting
// =============================================================================

/**
 * Convert MIME types array to HTML accept attribute string.
 */
export function toAcceptString(mimeTypes: readonly string[]): string {
  return mimeTypes.join(',');
}

/**
 * Format file size to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format MIME types to human-readable list.
 */
export function formatMimeTypes(mimeTypes: string[]): string {
  return formatSupportedUploadFormats(mimeTypes);
}
