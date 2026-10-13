'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { VisuallyHidden } from 'react-aria-components';
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type PercentCrop,
  type PixelCrop,
  type ReactCropProps,
} from 'react-image-crop';
import { LayoutInline } from '../Layout';
import { Text } from '../Typography';
import { ContentModal, DialogActions } from '../Modal';
import { Spinner as Loader } from '../Display';
import { Button } from '../Button';
import { cropImage } from './image-crop';
import { clampToAspectRange } from './aspect-range';

import 'react-image-crop/dist/ReactCrop.css';
import classes from './ImageCropper.module.css';

/** Aspect ratio configuration */
export type AspectRatioConfig =
  | number // Fixed aspect ratio (e.g., 1 for square, 16/9 for landscape)
  | 'free' // No aspect ratio constraint
  | { min: number; max: number }; // Range constraint (e.g., 9/16 to 16/9)

export interface CropAccessibility {
  labels: NonNullable<ReactCropProps['ariaLabels']>;
  describeSelection: (crop: PercentCrop) => string;
  instructions?: string;
}

export interface ImageCropperProps {
  /** Semantic copy is separate from the displayed title, preview and actions. */
  cropAccessibility?: CropAccessibility;
  /** Image source (data URL or blob URL) */
  imageSrc: string;
  /** Whether the modal is open */
  opened: boolean;
  /** Called when modal is closed */
  onClose: () => void;
  /** Called with cropped image blob. Return false to keep the editor open. */
  onCrop: (blob: Blob) => boolean | void | Promise<boolean | void>;
  /** Modal title */
  title: string;
  /** All visible and accessible copy is supplied by the owning feature. */
  labels: {
    previewAlt: string;
    cancel: string;
    confirm: string;
  };
  /** Aspect ratio configuration */
  aspectRatio?: AspectRatioConfig;
  /** Whether to show circular crop overlay (visual only, output is still square) */
  circularCrop?: boolean;
  /** Help text shown below the crop area */
  helpText?: string;
  /** Status text shown while the browser crops and encodes the image. */
  processingLabel?: string;
  /** Maximum encoded width. The crop is never upscaled. */
  maxOutputWidth?: number;
  /** Maximum encoded height. The crop is never upscaled. */
  maxOutputHeight?: number;
  /** JPEG/WebP encoding quality. */
  outputQuality?: number;
}

/**
 * Get initial crop based on aspect ratio config.
 */
function getInitialCrop(imageWidth: number, imageHeight: number, aspectRatio: AspectRatioConfig): PercentCrop {
  if (aspectRatio === 'free') {
    // Full image selected
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  }

  if (typeof aspectRatio === 'number') {
    // Fixed aspect ratio - center crop
    return centerCrop(
      makeAspectCrop({ unit: '%', width: 90 }, aspectRatio, imageWidth, imageHeight),
      imageWidth,
      imageHeight,
    );
  }

  // Range aspect ratio - clamp to bounds
  const imageAspect = imageWidth / imageHeight;
  const { min, max } = aspectRatio;

  if (imageAspect >= min && imageAspect <= max) {
    // Image is within bounds, use full image
    return { unit: '%', x: 0, y: 0, width: 100, height: 100 };
  }

  if (imageAspect > max) {
    // Image is too wide - constrain to max
    const cropHeight = 100;
    const cropWidth = (max / imageAspect) * 100;
    return { unit: '%', x: (100 - cropWidth) / 2, y: 0, width: cropWidth, height: cropHeight };
  }

  // Image is too tall - constrain to min
  const cropWidth = 100;
  const cropHeight = (imageAspect / min) * 100;
  return { unit: '%', x: 0, y: (100 - cropHeight) / 2, width: cropWidth, height: cropHeight };
}

/**
 * Generic image cropper component.
 *
 * Outputs WebP format at original crop size. Use imgproxy for resizing on delivery.
 *
 * Supports various aspect ratio configurations:
 * - Fixed: `aspectRatio={1}` for square, `aspectRatio={16/9}` for landscape
 * - Free: `aspectRatio="free"` for no constraint
 * - Range: `aspectRatio={{ min: 9/16, max: 16/9 }}` for flexible bounds
 *
 * @example
 * ```tsx
 * // Square avatar crop
 * <ImageCropper
 *   imageSrc={src}
 *   opened={open}
 *   onClose={() => setOpen(false)}
 *   onCrop={handleCrop}
 *   aspectRatio={1}
 *   circularCrop
 * />
 *
 * // 16:9 featured image crop
 * <ImageCropper
 *   imageSrc={src}
 *   opened={open}
 *   onClose={() => setOpen(false)}
 *   onCrop={handleCrop}
 *   aspectRatio={16/9}
 * />
 * ```
 */
export function ImageCropper({
  imageSrc,
  opened,
  onClose,
  onCrop,
  title,
  labels,
  aspectRatio = 'free',
  circularCrop = false,
  helpText,
  processingLabel,
  maxOutputWidth,
  maxOutputHeight,
  outputQuality,
  cropAccessibility,
}: ImageCropperProps) {
  const helpId = useId();
  const selectionId = useId();
  const instructionsId = useId();
  const [crop, setCrop] = useState<PercentCrop>();
  const [completedCrop, setCompletedCrop] = useState<PercentCrop>();
  const [isProcessing, setIsProcessing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget;
      const initialCrop = getInitialCrop(width, height, aspectRatio);
      setCrop(initialCrop);

      setCompletedCrop(initialCrop);
    },
    [aspectRatio],
  );

  const correctCrop = useCallback(
    (percentCrop: PercentCrop) => {
      const image = imgRef.current;
      if (image && typeof aspectRatio === 'object') {
        return clampToAspectRange(percentCrop, image.naturalWidth, image.naturalHeight, aspectRatio);
      }
      return percentCrop;
    },
    [aspectRatio],
  );

  const handleCropChange = (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    setCrop(correctCrop(percentCrop));
  };

  const handleCropComplete = (_pixelCrop: PixelCrop, percentCrop: PercentCrop) => {
    // Keyboard completion can contain the raw selection emitted before our correction.
    const correctedCrop = correctCrop(percentCrop);
    setCrop(correctedCrop);
    setCompletedCrop(correctedCrop);
  };

  const handleConfirm = async () => {
    const image = imgRef.current;
    if (!image || !completedCrop) {
      return;
    }

    setIsProcessing(true);
    try {
      const blob = await cropImage({
        image,
        crop: completedCrop,
        format: 'webp',
        quality: outputQuality,
        maxWidth: maxOutputWidth,
        maxHeight: maxOutputHeight,
      });

      if (blob) {
        const result = await onCrop(blob);
        if (result !== false) {
          onClose();
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Determine ReactCrop aspect prop
  const reactCropAspect = typeof aspectRatio === 'number' ? aspectRatio : undefined;

  return (
    <ContentModal
      opened={opened}
      onClose={onClose}
      title={title}
      closeLabel={labels.cancel}
      size="large"
      bodyLayout="fit"
      loading={isProcessing}
      centered
    >
      <div className={classes.content}>
        <div
          className={classes.stage}
          role="group"
          aria-label={title}
          aria-describedby={
            [
              helpText ? helpId : null,
              cropAccessibility?.instructions ? instructionsId : null,
              cropAccessibility && completedCrop ? selectionId : null,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          aria-busy={isProcessing || undefined}
        >
          <ReactCrop
            className={classes.cropper}
            ariaLabels={cropAccessibility?.labels}
            disabled={isProcessing}
            crop={crop}
            onChange={handleCropChange}
            onComplete={handleCropComplete}
            aspect={reactCropAspect}
            circularCrop={circularCrop}
          >
            <img ref={imgRef} src={imageSrc} alt={labels.previewAlt} onLoad={onImageLoad} className={classes.image} />
          </ReactCrop>
        </div>

        {cropAccessibility ? (
          <>
            {cropAccessibility.instructions ? (
              <VisuallyHidden id={instructionsId}>{cropAccessibility.instructions}</VisuallyHidden>
            ) : null}
            <VisuallyHidden id={selectionId} role="status" aria-live="polite" aria-atomic="true">
              {completedCrop ? cropAccessibility.describeSelection(completedCrop) : null}
            </VisuallyHidden>
          </>
        ) : null}
        {helpText && (
          <Text id={helpId} size="xs" tone="muted">
            {helpText}
          </Text>
        )}

        {isProcessing && processingLabel ? (
          <LayoutInline gap="xs" justify="end" role="status" aria-live="polite">
            <Loader size="xs" />
            <Text size="xs" tone="muted">
              {processingLabel}
            </Text>
          </LayoutInline>
        ) : null}

        <DialogActions>
          <Button tone="neutral" emphasis="medium" onClick={onClose} disabled={isProcessing}>
            {labels.cancel}
          </Button>
          <Button emphasis="strong" onClick={handleConfirm} loading={isProcessing} disabled={!completedCrop}>
            {labels.confirm}
          </Button>
        </DialogActions>
      </div>
    </ContentModal>
  );
}
