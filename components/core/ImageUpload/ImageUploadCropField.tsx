'use client';
import { SupportingText } from '../Typography';

import type { CSSProperties } from 'react';
import { LayoutInline, LayoutStack } from '../Layout';
import { IconInfoCircle } from '@tabler/icons-react';

import { Progress } from '../Progress';
import { ImageCropper, type AspectRatioConfig } from '../ImageCropper';
import type { CropAccessibility } from '../ImageCropper/ImageCropper';
import { ImageUploadField, type ImageUploadAccept, type ImageUploadRejection } from './ImageUploadField';
import { ImagePreviewHeader } from './ImagePreviewHeader';
import { Popover } from '../Popover';
import { IconButton } from '../IconButton';

export interface ImageUploadCropFieldLabels {
  field: string;
  imageAlt: string;
  emptyTitle: string;
  emptyDescription: string;
  constraints?: string;
  constraintsLabel?: string;
  readOnlyDescription: string;
  changeHint?: string;
  loading: string;
  removeButtonAriaLabel: string;
  cropTitle: string;
  cropPreviewAlt: string;
  cropCancel: string;
  cropConfirm: string;
  cropProcessing: string;
}

export interface ImageUploadCropFieldProps {
  cropAccessibility?: CropAccessibility;
  imageUrl: string | null;
  cropImageSrc: string | null;
  cropOpened: boolean;
  idPrefix?: string;
  canEdit: boolean;
  loading: boolean;
  progress?: number;
  removeButtonLoading: boolean;
  labels: ImageUploadCropFieldLabels;
  accept?: ImageUploadAccept;
  maxSize?: number;
  aspectRatio?: AspectRatioConfig;
  previewWidth?: CSSProperties['width'];
  previewMaxWidth?: CSSProperties['maxWidth'];
  previewMinHeight?: CSSProperties['minHeight'];
  onFileSelect: (file: File) => void;
  onReject: (rejections: ImageUploadRejection[]) => void;
  onRemove?: () => void;
  onCrop: (blob: Blob) => void;
  onCropClose: () => void;
}

/**
 * Domain-free image selection and crop surface. Upload policy, preprocessing,
 * persistence, notifications, and translated copy are supplied by its controller.
 */
export function ImageUploadCropField({
  imageUrl,
  cropAccessibility,
  cropImageSrc,
  cropOpened,
  idPrefix,
  canEdit,
  loading,
  progress,
  removeButtonLoading,
  labels,
  accept,
  maxSize,
  aspectRatio = 16 / 9,
  previewWidth = '100%',
  previewMaxWidth,
  previewMinHeight,
  onFileSelect,
  onReject,
  onRemove,
  onCrop,
  onCropClose,
}: ImageUploadCropFieldProps) {
  const minHeight = previewMinHeight ?? (typeof aspectRatio === 'number' ? undefined : 120);
  return (
    <LayoutStack gap="xxs">
      <ImagePreviewHeader label={labels.field} />

      <ImageUploadField
        imageUrl={imageUrl}
        alt={labels.imageAlt}
        inputId={idPrefix ? `${idPrefix}-file-input` : undefined}
        dropzoneId={idPrefix ? `${idPrefix}-dropzone` : undefined}
        accept={accept}
        maxSize={maxSize}
        canEdit={canEdit}
        disabled={loading}
        loading={loading}
        loadingLabel={labels.loading}
        progress={progress}
        emptyTitle={labels.emptyTitle}
        changeHint={imageUrl && canEdit ? labels.changeHint : undefined}
        removeButtonAriaLabel={labels.removeButtonAriaLabel}
        removeButtonLoading={removeButtonLoading}
        preview={{
          mode: aspectRatio === 'free' ? 'hug' : 'fixed',
          width: previewWidth,
          maxWidth: previewMaxWidth,
          aspectRatio: typeof aspectRatio === 'number' ? `${aspectRatio}` : undefined,
          minHeight,
          fit: aspectRatio === 'free' ? 'contain' : 'cover',
        }}
        placeholder={{
          width: previewWidth,
          minHeight,
          iconSize: 'md',
          compact: true,
          showCompactText: false,
        }}
        onFileSelect={onFileSelect}
        onValidationReject={onReject}
        onRemove={imageUrl && canEdit ? onRemove : undefined}
      />

      {loading ? (
        <div role="status" aria-live="polite">
          <Progress
            value={progress ?? null}
            title={labels.loading}
            status={progress !== undefined ? `${Math.round(progress)}%` : undefined}
            aria-label={labels.loading}
          />
        </div>
      ) : !imageUrl && (canEdit ? labels.emptyDescription || labels.constraints : labels.readOnlyDescription) ? (
        <LayoutInline gap="xxs" justify="between" align="start" wrap="nowrap">
          <SupportingText tone="muted" wrap="preserve">
            {canEdit ? labels.emptyDescription : labels.readOnlyDescription}
          </SupportingText>
          {canEdit && labels.constraints && labels.constraintsLabel ? (
            <Popover size="compact" placement="bottom-end">
              <Popover.Target>
                <IconButton size="xs" emphasis="low" aria-label={labels.constraintsLabel}>
                  <IconInfoCircle size="1em" />
                </IconButton>
              </Popover.Target>
              <Popover.Dropdown padding="compact">
                <SupportingText tone="secondary">{labels.constraints}</SupportingText>
              </Popover.Dropdown>
            </Popover>
          ) : null}
        </LayoutInline>
      ) : null}

      {cropImageSrc ? (
        <ImageCropper
          cropAccessibility={cropAccessibility}
          imageSrc={cropImageSrc}
          opened={cropOpened}
          onClose={onCropClose}
          onCrop={onCrop}
          title={labels.cropTitle}
          labels={{
            previewAlt: labels.cropPreviewAlt,
            cancel: labels.cropCancel,
            confirm: labels.cropConfirm,
          }}
          aspectRatio={aspectRatio}
          processingLabel={labels.cropProcessing}
        />
      ) : null}
    </LayoutStack>
  );
}
