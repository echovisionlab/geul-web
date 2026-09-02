import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { getUploadSelectionMimeTypes, UPLOAD_CONFIGS } from '@/lib/constants/upload-config';
import { isHeicInputMime } from '@/lib/types/upload/model';
import { convertToWebP } from '@/lib/utils/image-convert';
import { createCanonicalMimeSet, isMimeAllowedInSet } from '@/lib/utils/mime';
import {
  buildUnsupportedEditorMediaMessage,
  buildUnsupportedUploadTypeMessage,
  formatFileSize,
  getUploadTypeForMime,
  resolveUploadMimeType,
} from '@/lib/utils/upload';
import {
  getUploadSelectionMaxSize,
  MANAGED_RASTER_FINAL_MAX_SIZE,
  MANAGED_RASTER_MAX_DIMENSION,
  shouldNormalizeManagedRasterUpload,
} from '@/lib/utils/upload-policy';

export type UploadValidationResult =
  { valid: true; mimeType: string; uploadType: UploadType } | { valid: false; error: string };

function resolveUploadValidationContext(
  file: Pick<File, 'name' | 'type' | 'size'>,
  uploadType?: UploadType,
  phase: 'selection' | 'final' = 'final',
): UploadValidationResult {
  const resolvedMimeType = resolveUploadMimeType(file, uploadType);
  if (!resolvedMimeType) {
    return {
      valid: false,
      error:
        uploadType != null
          ? buildUnsupportedUploadTypeMessage(
              uploadType,
              file.type || undefined,
              phase === 'selection'
                ? getUploadSelectionMimeTypes(uploadType)
                : UPLOAD_CONFIGS[uploadType].permittedMimeTypes,
            )
          : buildUnsupportedEditorMediaMessage(file.type || undefined),
    };
  }

  const type = uploadType ?? getUploadTypeForMime(resolvedMimeType);
  const config = UPLOAD_CONFIGS[type];
  const allowedMimeSet = createCanonicalMimeSet(
    phase === 'selection' ? getUploadSelectionMimeTypes(type) : config.permittedMimeTypes,
  );

  if (!isMimeAllowedInSet(resolvedMimeType, allowedMimeSet)) {
    return {
      valid: false,
      error: buildUnsupportedUploadTypeMessage(
        type,
        file.type || resolvedMimeType,
        phase === 'selection' ? getUploadSelectionMimeTypes(type) : config.permittedMimeTypes,
      ),
    };
  }

  return { valid: true, mimeType: resolvedMimeType, uploadType: type };
}

/**
 * Validate a selected file before client-side preprocessing.
 */
export function validateUploadSelectionFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  uploadType?: UploadType,
): UploadValidationResult {
  const context = resolveUploadValidationContext(file, uploadType, 'selection');
  if (!context.valid) {
    return context;
  }

  const config = UPLOAD_CONFIGS[context.uploadType];
  const selectionMaxSize = getUploadSelectionMaxSize(context.uploadType, context.mimeType, config.maxSize);

  if (file.size > selectionMaxSize) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)} > ${formatFileSize(selectionMaxSize)}`,
    };
  }
  if (config.minSize !== undefined && file.size < config.minSize) {
    return {
      valid: false,
      error: `File too small: ${formatFileSize(file.size)} < ${formatFileSize(config.minSize)}`,
    };
  }

  return context;
}

/**
 * Validate a prepared file against final upload constraints.
 */
export function validateUploadFile(
  file: Pick<File, 'name' | 'type' | 'size'>,
  uploadType?: UploadType,
): UploadValidationResult {
  const context = resolveUploadValidationContext(file, uploadType);
  if (!context.valid) {
    return context;
  }

  const config = UPLOAD_CONFIGS[context.uploadType];
  if (file.size > config.maxSize) {
    return {
      valid: false,
      error: `File too large: ${formatFileSize(file.size)} > ${formatFileSize(config.maxSize)}`,
    };
  }
  if (config.minSize !== undefined && file.size < config.minSize) {
    return {
      valid: false,
      error: `File too small: ${formatFileSize(file.size)} < ${formatFileSize(config.minSize)}`,
    };
  }

  return context;
}

function uploadTypeAllowsWebP(uploadType: UploadType): boolean {
  return UPLOAD_CONFIGS[uploadType].permittedMimeTypes.includes('image/webp');
}

/**
 * Apply client-side preprocessing aligned with upload policy.
 * WebP conversion is only applied when the target upload type permits WebP.
 */
export async function preprocessUploadFile(file: File, uploadType: UploadType): Promise<File> {
  const resolvedMimeType = resolveUploadMimeType(file, uploadType);

  if (isHeicInputMime(resolvedMimeType)) {
    if (!uploadTypeAllowsWebP(uploadType)) {
      throw new Error('HEIC and HEIF images require an upload target that supports WebP.');
    }

    return convertToWebP(file, {
      maxDimension: MANAGED_RASTER_MAX_DIMENSION,
      maxBytes: UPLOAD_CONFIGS[uploadType].maxSize,
      quality: 0.86,
      minQuality: 0.56,
      qualityStep: 0.08,
    });
  }

  if (shouldNormalizeManagedRasterUpload(uploadType, resolvedMimeType)) {
    return convertToWebP(file, {
      maxDimension: MANAGED_RASTER_MAX_DIMENSION,
      maxBytes: MANAGED_RASTER_FINAL_MAX_SIZE,
      quality: 0.86,
      minQuality: 0.56,
      qualityStep: 0.08,
    });
  }

  if (!uploadTypeAllowsWebP(uploadType)) {
    return file;
  }
  const convertedFile = await convertToWebP(file);
  if (convertedFile.size > file.size) {
    return file;
  }
  return convertedFile;
}

/** Decode HEIC/HEIF before a browser preview or crop UI tries to render it. */
export async function prepareImageFileForPreview(file: File, uploadType: UploadType): Promise<File> {
  const selectionValidation = validateUploadSelectionFile(file, uploadType);
  if (!selectionValidation.valid) {
    throw new Error(selectionValidation.error);
  }
  if (!isHeicInputMime(selectionValidation.mimeType)) {
    return file;
  }

  const processedFile = await preprocessUploadFile(file, uploadType);
  const finalValidation = validateUploadFile(processedFile, uploadType);
  if (!finalValidation.valid) {
    throw new Error(finalValidation.error);
  }
  return processedFile;
}

/**
 * Prepare file for upload (preprocess + validate) and return canonical MIME.
 */
export async function prepareUploadFile(file: File, uploadType: UploadType): Promise<{ file: File; mimeType: string }> {
  const selectionValidation = validateUploadSelectionFile(file, uploadType);
  if (!selectionValidation.valid) {
    throw new Error(selectionValidation.error);
  }

  const processedFile = await preprocessUploadFile(file, uploadType);
  const validation = validateUploadFile(processedFile, uploadType);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  return { file: processedFile, mimeType: validation.mimeType };
}
