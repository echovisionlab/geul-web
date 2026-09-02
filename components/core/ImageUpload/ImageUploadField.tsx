'use client';

import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { Box, Text } from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import { IconButton } from '../IconButton';
import { isFileDragTransfer } from './file-drag';
import { ImagePreviewFrame } from './ImagePreviewFrame';
import { UploadPlaceholder } from './UploadPlaceholder';

type ImageUploadPreviewMode = 'circle' | 'fixed' | 'hug';
type ImageUploadPreviewFit = 'contain' | 'cover';

export type ImageUploadAccept = readonly string[] | Readonly<Record<string, readonly string[]>>;

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
  radius?: CSSProperties['borderRadius'];
  background?: CSSProperties['background'];
  border?: CSSProperties['border'];
}

interface ImageUploadPlaceholderConfig {
  width?: CSSProperties['width'];
  maxWidth?: CSSProperties['maxWidth'];
  height?: CSSProperties['height'];
  minHeight?: CSSProperties['minHeight'];
  aspectRatio?: CSSProperties['aspectRatio'];
  radius?: CSSProperties['borderRadius'];
  icon?: ReactNode;
  iconSize?: number;
  compact?: boolean;
  showCompactText?: boolean;
}

export interface ImageUploadFieldProps {
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
  removeButtonOffset?: number;
  preview: ImageUploadPreviewConfig;
  placeholder?: ImageUploadPlaceholderConfig;
  onFileSelect?: (file: File) => void | Promise<void>;
  onReject?: (rejections: FileRejection[]) => void;
  onValidationReject?: (rejections: ImageUploadRejection[]) => void;
  onRemove?: () => void | Promise<void>;
}

function getPreviewFrameStyle(preview: ImageUploadPreviewConfig, dropActive: boolean): CSSProperties {
  const border =
    preview.border ?? `1px solid ${dropActive ? 'var(--mantine-color-blue-5)' : 'var(--mantine-color-default-border)'}`;

  if (preview.mode === 'circle') {
    return {
      position: 'relative',
      width: preview.width,
      height: preview.height ?? preview.width,
      maxWidth: preview.maxWidth,
      maxHeight: preview.maxHeight,
      minHeight: preview.minHeight,
      overflow: 'hidden',
      borderRadius: '50%',
      border,
      background: preview.background,
    };
  }

  if (preview.mode === 'hug') {
    return {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: preview.width,
      maxWidth: preview.maxWidth ?? '100%',
      maxHeight: preview.maxHeight,
      minHeight: preview.minHeight,
      overflow: 'hidden',
      borderRadius: preview.radius,
      border,
      background: preview.background ?? 'var(--mantine-color-body)',
    };
  }

  return {
    position: 'relative',
    width: preview.width ?? '100%',
    height: preview.height,
    maxWidth: preview.maxWidth,
    maxHeight: preview.maxHeight,
    minHeight: preview.minHeight,
    aspectRatio: preview.aspectRatio,
    overflow: 'hidden',
    borderRadius: preview.radius,
    border,
    background: preview.background,
  };
}

function getImageStyle(preview: ImageUploadPreviewConfig): CSSProperties {
  const objectFit = preview.fit ?? (preview.mode === 'hug' ? 'contain' : 'cover');

  if (preview.mode === 'hug') {
    return {
      display: 'block',
      width: 'auto',
      height: preview.height ?? preview.maxHeight ?? 'auto',
      maxWidth: '100%',
      maxHeight: preview.maxHeight,
      objectFit,
    };
  }

  return {
    display: 'block',
    width: '100%',
    height: '100%',
    objectFit,
  };
}

function getPreviewSurfaceWidth(preview: ImageUploadPreviewConfig): CSSProperties['width'] {
  if (preview.mode === 'fixed') {
    return preview.width ?? '100%';
  }

  return preview.width === undefined || preview.width === 'auto' ? 'fit-content' : preview.width;
}

function getPlaceholderSurfaceSize(
  preview: ImageUploadPreviewConfig,
  placeholder: ImageUploadPlaceholderConfig | undefined,
): Pick<CSSProperties, 'width' | 'maxWidth'> {
  return {
    width: placeholder?.width ?? preview.width ?? '100%',
    maxWidth: placeholder?.maxWidth ?? '100%',
  };
}

function isAcceptList(accept: ImageUploadAccept): accept is readonly string[] {
  return Array.isArray(accept);
}

function getInputAccept(accept: ImageUploadAccept | undefined): string | undefined {
  if (!accept) {
    return undefined;
  }

  if (isAcceptList(accept)) {
    return accept.join(',');
  }

  const values = Object.entries(accept).flatMap(([mimeType, extensions]) => [mimeType, ...extensions]);
  return [...new Set(values)].join(',');
}

function getDropzoneAccept(accept: ImageUploadAccept | undefined): string[] | Record<string, string[]> | undefined {
  if (!accept) {
    return undefined;
  }

  if (isAcceptList(accept)) {
    return [...accept];
  }

  return Object.fromEntries(Object.entries(accept).map(([mimeType, extensions]) => [mimeType, [...extensions]]));
}

function toImageUploadRejections(rejections: FileRejection[]): ImageUploadRejection[] {
  return rejections.map(({ file, errors }) => {
    const errorCode = errors[0]?.code;
    const reason: ImageUploadRejectionReason =
      errorCode === 'file-too-large' ? 'too-large' : errorCode === 'file-invalid-type' ? 'invalid-type' : 'unknown';

    return { file, reason };
  });
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
  removeButtonOffset = -4,
  preview,
  placeholder,
  onFileSelect,
  onReject,
  onValidationReject,
  onRemove,
}: ImageUploadFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDropActive, setIsDropActive] = useState(false);
  const hasImage = Boolean(imageUrl);
  const interactive = canEdit && !disabled && !loading && Boolean(onFileSelect);
  const placeholderIconSize = placeholder?.iconSize ?? 26;
  const placeholderSurfaceSize = getPlaceholderSurfaceSize(preview, placeholder);

  const handleSelectFile = useCallback(
    (file: File) => {
      void onFileSelect?.(file);
    },
    [onFileSelect],
  );

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0];
      if (file) {
        handleSelectFile(file);
      }
      event.currentTarget.value = '';
    },
    [handleSelectFile],
  );

  const handleDrop = useCallback(
    (files: File[]) => {
      setIsDropActive(false);
      const file = files[0];
      if (file) {
        handleSelectFile(file);
      }
    },
    [handleSelectFile],
  );

  const handleReject = useCallback(
    (rejections: FileRejection[]) => {
      setIsDropActive(false);
      onReject?.(rejections);
      onValidationReject?.(toImageUploadRejections(rejections));
    },
    [onReject, onValidationReject],
  );

  const openFilePicker = useCallback(() => {
    if (interactive) {
      fileInputRef.current?.click();
    }
  }, [interactive]);

  const removeButton =
    onRemove && hasImage && removeButtonAriaLabel ? (
      <IconButton
        size="xs"
        shape="circle"
        emphasis="strong"
        tone="danger"
        pos="absolute"
        top={removeButtonOffset}
        right={removeButtonOffset}
        onClick={(event) => {
          event.stopPropagation();
          void onRemove();
        }}
        loading={removeButtonLoading}
        aria-label={removeButtonAriaLabel}
      >
        <IconX size={12} />
      </IconButton>
    ) : null;

  const previewFrame =
    preview.mode === 'fixed' ? (
      <ImagePreviewFrame
        src={imageUrl}
        alt={alt}
        width={preview.width ?? '100%'}
        maxWidth={preview.maxWidth}
        height={preview.height}
        maxHeight={preview.maxHeight}
        minHeight={preview.minHeight}
        aspectRatio={preview.aspectRatio}
        fit={preview.fit}
        radius={preview.radius}
        background={preview.background}
        border={preview.border}
        dropActive={isDropActive}
        interactive={interactive}
        onClick={openFilePicker}
        actions={removeButton}
      />
    ) : (
      <Box pos="relative" w={getPreviewSurfaceWidth(preview)} maw={preview.maxWidth}>
        <Box
          onClick={openFilePicker}
          style={{
            ...getPreviewFrameStyle(preview, isDropActive),
            cursor: interactive ? 'pointer' : 'default',
          }}
        >
          {imageUrl ? <img src={imageUrl} alt={alt} style={getImageStyle(preview)} /> : null}
        </Box>
        {removeButton}
      </Box>
    );

  return (
    <Box>
      {label ? (
        <Text size="sm" fw={500} mb={4}>
          {label}
        </Text>
      ) : null}

      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={getInputAccept(accept)}
        onChange={handleInputChange}
        disabled={!interactive}
        hidden
      />

      {loading ? (
        <UploadPlaceholder
          icon={<IconPhoto size={placeholderIconSize} stroke={1.5} />}
          title={loadingLabel}
          statusMessage={loadingLabel}
          loading
          progress={progress}
          width={placeholderSurfaceSize.width}
          maxWidth={placeholderSurfaceSize.maxWidth}
          height={placeholder?.height ?? preview.height}
          minHeight={placeholder?.minHeight ?? preview.minHeight}
          aspectRatio={placeholder?.aspectRatio ?? preview.aspectRatio}
          radius={placeholder?.radius}
          compact={placeholder?.compact}
          showCompactText={placeholder?.showCompactText}
        />
      ) : hasImage ? (
        <Dropzone
          id={dropzoneId}
          aria-label={dropzoneAriaLabel}
          inputProps={dropzoneAriaLabel ? { 'aria-label': dropzoneAriaLabel } : undefined}
          onDrop={handleDrop}
          onReject={handleReject}
          accept={getDropzoneAccept(accept)}
          maxSize={maxSize}
          disabled={!interactive}
          activateOnClick={false}
          onClick={openFilePicker}
          onDragOver={(event) => {
            if (!isFileDragTransfer(event.dataTransfer)) {
              return;
            }
            setIsDropActive(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setIsDropActive(false);
          }}
          onDropCapture={() => setIsDropActive(false)}
          p={0}
          style={{
            width: getPreviewSurfaceWidth(preview),
            maxWidth: '100%',
          }}
        >
          {previewFrame}
        </Dropzone>
      ) : (
        <Dropzone
          id={dropzoneId}
          aria-label={dropzoneAriaLabel}
          inputProps={dropzoneAriaLabel ? { 'aria-label': dropzoneAriaLabel } : undefined}
          onDrop={handleDrop}
          onReject={handleReject}
          accept={getDropzoneAccept(accept)}
          maxSize={maxSize}
          disabled={!interactive}
          activateOnClick={false}
          onClick={openFilePicker}
          onDragOver={(event) => {
            if (!isFileDragTransfer(event.dataTransfer)) {
              return;
            }
            setIsDropActive(true);
          }}
          onDragLeave={(event) => {
            if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
              return;
            }
            setIsDropActive(false);
          }}
          onDropCapture={() => setIsDropActive(false)}
          p={0}
          style={{
            ...placeholderSurfaceSize,
            cursor: interactive ? 'pointer' : 'default',
          }}
        >
          <UploadPlaceholder
            icon={
              placeholder?.icon ?? (
                <>
                  <Dropzone.Accept>
                    <IconUpload size={placeholderIconSize} stroke={1.5} />
                  </Dropzone.Accept>
                  <Dropzone.Reject>
                    <IconX size={placeholderIconSize} stroke={1.5} />
                  </Dropzone.Reject>
                  <Dropzone.Idle>
                    <IconPhoto size={placeholderIconSize} stroke={1.5} />
                  </Dropzone.Idle>
                </>
              )
            }
            title={emptyTitle}
            description={emptyDescription}
            width={placeholderSurfaceSize.width}
            maxWidth={placeholderSurfaceSize.maxWidth}
            height={placeholder?.height ?? preview.height}
            minHeight={placeholder?.minHeight ?? preview.minHeight}
            aspectRatio={placeholder?.aspectRatio ?? preview.aspectRatio}
            radius={placeholder?.radius}
            interactive={interactive}
            compact={placeholder?.compact}
            showCompactText={placeholder?.showCompactText}
            dropActive={isDropActive}
          />
        </Dropzone>
      )}

      {hasImage && changeHint ? (
        <Text size="xs" c="dimmed" mt={4}>
          {changeHint}
        </Text>
      ) : null}
    </Box>
  );
}
