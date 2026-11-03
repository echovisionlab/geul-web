'use client';
import type { ClosedVisualProps } from '../visual-contract';

import { type CSSProperties, type ReactNode } from 'react';
import { IconPhoto, IconX } from '@tabler/icons-react';
import { Button as AriaButton, DropZone, FileTrigger } from 'react-aria-components';
import { LayoutStack } from '../Layout';
import { Text } from '../Typography';
import { fileSelectionReason } from '../file-selection';
import classes from './ImageUpload.module.css';
import { IconButton } from '../IconButton';
import { ImagePreviewFrame, type ImagePreviewSurface } from './ImagePreviewFrame';
import { UploadPlaceholder } from './UploadPlaceholder';

type ImageUploadPreviewMode = 'circle' | 'fixed' | 'hug';
type ImageUploadPreviewFit = 'contain' | 'cover';

export type ImageUploadAccept = readonly string[] | Readonly<Record<string, readonly string[]>>;

export interface FileRejection {
  file: File;
  errors: readonly { code: 'file-too-large' | 'file-invalid-type'; message: string }[];
}

export type ImageUploadRejectionReason = 'too-large' | 'invalid-type' | 'unknown';

export interface ImageUploadRejection {
  file: File;
  reason: ImageUploadRejectionReason;
}

interface ImageUploadPreviewConfig {
  mode: ImageUploadPreviewMode;
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  maxWidth?: CSSProperties['maxWidth'];
  maxHeight?: CSSProperties['maxHeight'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  fit?: ImageUploadPreviewFit;
  shape?: 'square' | 'circle';
  surface?: ImagePreviewSurface;
  withBorder?: boolean;
}

interface ImageUploadPlaceholderConfig {
  width?: CSSProperties['width'];
  maxWidth?: CSSProperties['maxWidth'];
  height?: CSSProperties['height'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  shape?: 'square' | 'circle';
  icon?: ReactNode;
  iconSize?: 'sm' | 'md' | 'lg';
  compact?: boolean;
  showCompactText?: boolean;
}

export interface ImageUploadFieldProps extends ClosedVisualProps {
  imageUrl?: string | null;
  alt: string;
  label?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  changeHint?: string;
  loadingLabel?: string;
  loading?: boolean;
  progress?: number;
  disabled?: boolean;
  canEdit?: boolean;
  inputId?: string;
  dropzoneId?: string;
  dropzoneAriaLabel?: string;
  accept?: ImageUploadAccept;
  maxSize?: number;
  removeButtonAriaLabel?: string;
  removeButtonLoading?: boolean;
  /** Keep the default quiet removal; strong is an explicit destructive-action exception. */
  removeButtonEmphasis?: 'medium' | 'strong';
  removeButtonPlacement?: 'outside' | 'inside';
  /** Avatar removal uses a small badge over the image; the interaction target stays full size. */
  removeButtonAppearance?: 'default' | 'avatar';
  preview: ImageUploadPreviewConfig;
  placeholder?: ImageUploadPlaceholderConfig;
  onFileSelect?: (file: File) => void | Promise<void>;
  onReject?: (rejections: FileRejection[]) => void;
  onValidationReject?: (rejections: ImageUploadRejection[]) => void;
  onRemove?: () => void | Promise<void>;
}

function inputAccept(accept?: ImageUploadAccept): string | undefined {
  if (!accept) {
    return undefined;
  }
  const values = Array.isArray(accept)
    ? accept
    : Object.entries(accept).flatMap(([mime, extensions]) => [mime, ...extensions]);
  return [...new Set(values)].join(',');
}
export function ImageUploadField({
  imageUrl,
  alt,
  label,
  emptyTitle,
  emptyDescription,
  changeHint,
  loadingLabel,
  loading = false,
  progress,
  disabled = false,
  canEdit = true,
  inputId,
  dropzoneId,
  dropzoneAriaLabel,
  accept,
  maxSize,
  removeButtonAriaLabel,
  removeButtonLoading = false,
  removeButtonEmphasis = 'medium',
  removeButtonPlacement = 'outside',
  removeButtonAppearance = 'default',
  preview,
  placeholder,
  onFileSelect,
  onReject,
  onValidationReject,
  onRemove,
}: ImageUploadFieldProps) {
  if (removeButtonAppearance === 'avatar' && (preview.mode !== 'circle' || removeButtonPlacement !== 'inside')) {
    throw new TypeError('Avatar removal requires a circle preview and inside placement');
  }
  const interactive = canEdit && !disabled && !loading && Boolean(onFileSelect);
  const acceptedTypes = inputAccept(accept);
  const select = (files: readonly File[]) => {
    if (!interactive || !files.length) {
      return;
    }
    const file = files[0];
    const reason = fileSelectionReason(file, acceptedTypes, maxSize);
    if (reason) {
      onReject?.([
        { file, errors: [{ code: reason === 'too-large' ? 'file-too-large' : 'file-invalid-type', message: reason }] },
      ]);
      onValidationReject?.([{ file, reason }]);
    } else {
      void onFileSelect?.(file);
    }
  };
  const hasImage = Boolean(imageUrl);
  // A hugging preview's box (and its corner remove action) is exactly the image's width.
  const previewWidth =
    preview.mode === 'hug' ? 'fit-content' : (preview.width ?? (preview.mode === 'fixed' ? '100%' : 'fit-content'));
  const geometry = {
    width: hasImage ? previewWidth : (placeholder?.width ?? preview.width ?? '100%'),
    maxWidth: hasImage ? (preview.maxWidth ?? '100%') : (placeholder?.maxWidth ?? '100%'),
  };
  const shape = placeholder?.shape ?? (preview.mode === 'circle' ? 'circle' : preview.shape);
  const placeholderView = (active = false) => (
    <UploadPlaceholder
      icon={placeholder?.icon ?? <IconPhoto size="1em" stroke={1.5} />}
      iconSize={placeholder?.iconSize}
      title={loading ? loadingLabel : emptyTitle}
      description={emptyDescription}
      statusMessage={loadingLabel}
      loading={loading}
      progress={progress}
      width={geometry.width}
      maxWidth={geometry.maxWidth}
      height={placeholder?.height ?? preview.height}
      minHeight={placeholder?.minHeight ?? preview.minHeight}
      aspectRatio={placeholder?.aspectRatio ?? preview.aspectRatio}
      shape={shape}
      compact={placeholder?.compact}
      showCompactText={placeholder?.showCompactText}
      interactive={interactive}
      dropActive={active}
    />
  );
  const previewView = (active: boolean) => (
    <ImagePreviewFrame
      src={imageUrl}
      alt={alt}
      width={preview.mode === 'hug' ? 'fit-content' : '100%'}
      maxWidth={preview.maxWidth}
      height={preview.height ?? (preview.mode === 'circle' ? preview.width : undefined)}
      maxHeight={preview.maxHeight}
      minHeight={preview.minHeight}
      aspectRatio={preview.aspectRatio}
      fit={preview.fit ?? (preview.mode === 'hug' ? 'contain' : 'cover')}
      shape={preview.mode === 'circle' ? 'circle' : preview.shape}
      surface={preview.surface}
      withBorder={preview.withBorder}
      dropActive={active}
      renderImage={
        preview.mode === 'hug'
          ? ({ src, alt }) => (
              <img
                src={src}
                alt={alt}
                style={{
                  display: 'block',
                  width: 'auto',
                  height: preview.height ?? preview.maxHeight ?? 'auto',
                  maxWidth: '100%',
                  maxHeight: preview.maxHeight,
                  objectFit: preview.fit ?? 'contain',
                }}
              />
            )
          : undefined
      }
    />
  );
  const accessibleLabel = dropzoneAriaLabel ?? emptyTitle ?? label ?? alt;
  // Reserved whether or not an image is present so uploading never shifts the layout.
  const reservesRemoveGutter = Boolean(onRemove && removeButtonAriaLabel) && removeButtonPlacement !== 'inside';
  return (
    <LayoutStack gap="xxs">
      {label ? (
        <Text size="sm" weight="medium">
          {label}
        </Text>
      ) : null}
      {loading ? (
        <RemoveGutter reserved={reservesRemoveGutter}>{placeholderView()}</RemoveGutter>
      ) : (
        <RemoveGutter reserved={reservesRemoveGutter}>
          <div id={dropzoneId} className={classes.wrapper} style={geometry}>
            <DropZone
              className={classes.dropzone}
              style={geometry}
              aria-label={accessibleLabel}
              isDisabled={!interactive}
              onDrop={async (event) =>
                select(
                  await Promise.all(event.items.filter((item) => item.kind === 'file').map((item) => item.getFile())),
                )
              }
            >
              {({ isDropTarget }) => (
                <FileTrigger
                  ref={(input) => {
                    if (input) {
                      if (inputId) {
                        input.id = inputId;
                      }
                      input.setAttribute('aria-label', accessibleLabel);
                    }
                  }}
                  acceptedFileTypes={acceptedTypes?.split(',')}
                  onSelect={(files) => select(Array.from(files ?? []))}
                >
                  <AriaButton className={classes.trigger} aria-label={accessibleLabel} isDisabled={!interactive}>
                    {hasImage ? previewView(isDropTarget) : placeholderView(isDropTarget)}
                  </AriaButton>
                </FileTrigger>
              )}
            </DropZone>
            {onRemove && hasImage && removeButtonAriaLabel ? (
              <IconButton
                {...(removeButtonAppearance === 'avatar'
                  ? { appearance: 'media-overlay', placement: 'overlay-end-inside' }
                  : {
                      size: 'xs',
                      shape: 'circle',
                      placement: removeButtonPlacement === 'inside' ? 'overlay-end-inside' : 'overlay-end',
                    })}
                emphasis={removeButtonEmphasis === 'strong' ? 'strong' : 'medium'}
                tone="danger"
                onClick={() => void onRemove()}
                loading={removeButtonLoading}
                disabled={disabled || loading}
                aria-label={removeButtonAriaLabel}
              >
                <IconX size="1em" />
              </IconButton>
            ) : null}
          </div>
        </RemoveGutter>
      )}
      {hasImage && changeHint ? (
        <Text size="xs" tone="muted">
          {changeHint}
        </Text>
      ) : null}
    </LayoutStack>
  );
}

function RemoveGutter({ reserved, children }: { reserved: boolean; children: ReactNode }) {
  return reserved ? <div className={classes.removeGutter}>{children}</div> : children;
}
