'use client';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { onDemandModule } from '@/components/core/on-demand-module';
import { ContentModal } from '@/components/core/Modal';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { type FileRejection, ImageUploadField, type ImageUploadRejection } from '@/components/core/ImageUpload';
import { ToolbarDensityProvider } from '@/components/core/control-context';
import type { CropAccessibility } from '@/components/core/ImageCropper/ImageCropper';

// The cropper (react-image-crop and its stylesheet) renders only after a file is chosen.
// Loading it on demand keeps it out of every account route that shows the avatar control.
const cropperModule = onDemandModule(() => import('@/components/core/ImageCropper'));
const USER_AVATAR_OUTPUT_DIMENSION = 1024;
const USER_AVATAR_OUTPUT_QUALITY = 0.85;
export interface ProfileAvatarControlLabels {
  alt: string;
  upload: string;
  change: string;
  remove: string;
  cropTitle: string;
  cropPreview: string;
  cancel: string;
  confirm: string;
  preparing: string;
  loadFailed: string;
  retry: string;
}
export interface ProfileAvatarControlProps {
  imageUrl?: string | null;
  size?: number;
  accept: readonly string[];
  maxSize: number;
  labels: ProfileAvatarControlLabels;
  loadingSurface: ReactNode;
  cropAccessibility?: CropAccessibility;
  disabled?: boolean;
  validateFile?: (file: File) => string | null;
  prepareFile?: (file: File) => Promise<File>;
  onValidationError?: (message: string) => void;
  onFileRejected?: (rejections: FileRejection[]) => void;
  onValidationReject?: (rejections: ImageUploadRejection[]) => void;
  onSave: (blob: Blob) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
}
/**
 * Pure profile-avatar editing UI. Upload policy, persistence, notifications,
 * and session refresh are supplied by its controller through props.
 */
export function ProfileAvatarControl({
  imageUrl,
  size = 80,
  accept,
  maxSize,
  labels,
  loadingSurface,
  cropAccessibility,
  disabled = false,
  validateFile,
  prepareFile,
  onValidationError,
  onFileRejected,
  onValidationReject,
  onSave,
  onRemove,
}: ProfileAvatarControlProps) {
  const generation = useRef(0);
  const [cropper, setCropper] = useState(cropperModule.peek);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [operation, setOperation] = useState<'idle' | 'preparing' | 'removing'>('idle');
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const cropImageRef = useRef<string | null>(null);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const normalizedImageUrl = imageUrl?.trim() ?? '';
  const hasImage = normalizedImageUrl.length > 0;
  const clearCropImage = useCallback(() => {
    if (cropImageRef.current) {
      URL.revokeObjectURL(cropImageRef.current);
      cropImageRef.current = null;
    }
    setCropImageUrl(null);
    setCropModalOpen(false);
  }, []);
  useEffect(
    () => () => {
      generation.current += 1;
      if (cropImageRef.current) {
        URL.revokeObjectURL(cropImageRef.current);
        cropImageRef.current = null;
      }
    },
    [],
  );
  useEffect(() => {
    if (!cropImageUrl || cropper) {
      return;
    }
    let active = true;
    setLoadFailed(false);
    void cropperModule.load().then(
      (module) => {
        if (active) {
          setCropper(module);
        }
      },
      () => {
        if (active) {
          setLoadFailed(true);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [cropImageUrl, cropper, retry]);
  const ImageCropper = cropper?.ImageCropper;
  const openFile = useCallback(
    async (file: File) => {
      const validationError = validateFile?.(file);
      if (validationError) {
        onValidationError?.(validationError);
        return;
      }
      const request = ++generation.current;
      setOperation('preparing');
      try {
        const previewFile = prepareFile ? await prepareFile(file) : file;
        if (request !== generation.current) {
          return;
        }
        clearCropImage();
        const previewUrl = URL.createObjectURL(previewFile);
        cropImageRef.current = previewUrl;
        setCropImageUrl(previewUrl);
        setCropModalOpen(true);
      } catch (error) {
        if (request !== generation.current) {
          return;
        }
        onValidationError?.(error instanceof Error ? error.message : 'Failed to prepare image.');
      } finally {
        if (request === generation.current) {
          setOperation('idle');
        }
      }
    },
    [clearCropImage, onValidationError, prepareFile, validateFile],
  );
  const handleCrop = useCallback(
    async (blob: Blob) => {
      const saved = await onSave(blob);
      if (saved) {
        clearCropImage();
      }
      return saved;
    },
    [clearCropImage, onSave],
  );
  const handleRemove = useCallback(async () => {
    if (!onRemove || !hasImage) {
      return;
    }
    setOperation('removing');
    try {
      await onRemove();
    } finally {
      setOperation('idle');
    }
  }, [hasImage, onRemove]);
  const busy = disabled || operation !== 'idle';
  return (
    <DsLayoutStack gap="xxs">
      <ToolbarDensityProvider density="compact">
        <ImageUploadField
          imageUrl={normalizedImageUrl || null}
          alt={labels.alt}
          dropzoneAriaLabel={hasImage ? labels.change : labels.upload}
          accept={accept}
          maxSize={maxSize}
          disabled={busy}
          loading={operation === 'preparing'}
          loadingLabel={labels.preparing}
          removeButtonAriaLabel={labels.remove}
          removeButtonLoading={operation === 'removing'}
          removeButtonEmphasis="strong"
          removeButtonPlacement="inside"
          removeButtonAppearance="avatar"
          preview={{
            mode: 'circle',
            width: size,
            height: size,
            fit: 'cover',
          }}
          placeholder={{
            width: size,
            height: size,
            minHeight: size,
            shape: 'circle',
            iconSize: 'md',
            compact: true,
          }}
          onFileSelect={(file) => void openFile(file)}
          onReject={onFileRejected}
          onValidationReject={onValidationReject}
          onRemove={onRemove && hasImage ? handleRemove : undefined}
        />
      </ToolbarDensityProvider>

      {cropImageUrl && ImageCropper ? (
        <ImageCropper
          imageSrc={cropImageUrl}
          opened={cropModalOpen}
          onClose={clearCropImage}
          onCrop={handleCrop}
          title={labels.cropTitle}
          cropAccessibility={cropAccessibility}
          labels={{
            previewAlt: labels.cropPreview,
            cancel: labels.cancel,
            confirm: labels.confirm,
          }}
          aspectRatio={1}
          circularCrop
          processingLabel={labels.preparing}
          maxOutputWidth={USER_AVATAR_OUTPUT_DIMENSION}
          maxOutputHeight={USER_AVATAR_OUTPUT_DIMENSION}
          outputQuality={USER_AVATAR_OUTPUT_QUALITY}
        />
      ) : cropImageUrl ? (
        <ContentModal
          opened={cropModalOpen}
          onClose={clearCropImage}
          title={labels.cropTitle}
          closeLabel={labels.cancel}
          centered
        >
          {loadFailed ? (
            <DsLayoutStack gap="sm">
              <Alert tone="danger">{labels.loadFailed}</Alert>
              <Button onClick={() => setRetry((value) => value + 1)}>{labels.retry}</Button>
            </DsLayoutStack>
          ) : (
            loadingSurface
          )}
        </ContentModal>
      ) : null}
    </DsLayoutStack>
  );
}
