// @vitest-environment jsdom

import { act } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageUploadCropFieldProps, ImageUploadRejectionReason } from '@/components/core/ImageUpload';
import { ImageUploadCropController, type ImageUploadCropControllerProps } from './ImageUploadCropController';

const {
  notificationShowMock,
  getCropFieldProps,
  setCropFieldProps,
  handleFileDropMock,
  handleCropCompleteMock,
  handleCropCancelMock,
} = vi.hoisted(() => {
  let cropFieldProps: unknown = null;

  return {
    notificationShowMock: vi.fn(),
    getCropFieldProps: () => cropFieldProps,
    setCropFieldProps: (value: unknown) => {
      cropFieldProps = value;
    },
    handleFileDropMock: vi.fn(),
    handleCropCompleteMock: vi.fn(),
    handleCropCancelMock: vi.fn(),
  };
});

vi.mock('@/components/core/ImageUpload', () => ({
  ImageUploadCropField: (props: unknown) => {
    setCropFieldProps(props);
    return <div data-testid="image-upload-crop-field" />;
  },
}));

vi.mock('./useImageUploadCrop', () => ({
  useImageUploadCrop: () => ({
    isPreparing: false,
    tempImageSrc: null,
    cropModalOpened: false,
    handleFileDrop: handleFileDropMock,
    handleCropComplete: handleCropCompleteMock,
    handleCropCancel: handleCropCancelMock,
  }),
}));

vi.mock('@/components/core/Notification', () => ({
  notifications: { show: notificationShowMock },
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: { ratio?: string }) =>
    values?.ratio ? `${namespace}.${key}: ${values.ratio}` : `${namespace}.${key}`,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function renderController(overrides: Partial<ImageUploadCropControllerProps> = {}) {
  act(() => {
    root.render(
      <ImageUploadCropController
        imageUrl={null}
        canEdit
        isUploading={false}
        uploadProgress={0}
        isRemoving={false}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        {...overrides}
      />,
    );
  });
}

function getRenderedCropFieldProps(): ImageUploadCropFieldProps {
  const props = getCropFieldProps();
  if (!props) {
    throw new Error('Expected the controller to render ImageUploadCropField');
  }
  return props as ImageUploadCropFieldProps;
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  setCropFieldProps(null);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setCropFieldProps(null);
  vi.clearAllMocks();
});

describe('ImageUploadCropController rejection policy', () => {
  it.each([
    ['too-large', 'featuredImage.errors.fileTooLarge'],
    ['invalid-type', 'featuredImage.errors.invalidFileType'],
    ['unknown', 'featuredImage.errors.fileRejected'],
  ] as const)(
    'maps the Core %s rejection reason to %s',
    (reason: ImageUploadRejectionReason, expectedMessage: string) => {
      renderController();
      const file = new File(['image'], 'image.png', { type: 'image/png' });

      act(() => getRenderedCropFieldProps().onReject([{ file, reason }]));

      expect(notificationShowMock).toHaveBeenCalledWith({
        message: expectedMessage,
        tone: 'danger',
      });
    },
  );
});

describe('ImageUploadCropController aspect ratio', () => {
  it('passes named crop handles and current selection values without adding visible guidance', () => {
    renderController();
    const props = getRenderedCropFieldProps();
    expect(Object.keys(props.cropAccessibility?.labels ?? {})).toHaveLength(9);
    expect(props.cropAccessibility?.labels.cropArea).toBe('featuredImage.cropTitle');
    expect(props.cropAccessibility?.labels.nwDragHandle).toContain('common.labels.top');
    expect(props.cropAccessibility?.labels.nwDragHandle).toContain('common.labels.left');
    expect(props.cropAccessibility?.describeSelection({ unit: '%', x: 10, y: 20, width: 30, height: 40 })).toContain(
      'common.labels.width: 30%',
    );
    expect(props.labels.emptyDescription).toBe('');
    expect(props.labels.constraints).toBeUndefined();
  });

  it('keeps the social-card crop without persistent size captions or help controls', () => {
    renderController();
    const props = getRenderedCropFieldProps();
    expect(props.aspectRatio).toBe(1200 / 630);
    expect(props.previewMinHeight).toBeUndefined();
    expect(props.labels.emptyDescription).toBe('');
    expect(props.labels.readOnlyDescription).toBe('');
    expect(props.labels.constraints).toBeUndefined();
    expect(props.labels.changeHint).toBeUndefined();
  });

  it.each([16 / 9, 1, 4 / 3, 9 / 16, 1.234, { min: 9 / 16, max: 1.234 }, 'free'] as const)(
    'keeps crop geometry %j without persistent captions or constraint controls',
    (aspectRatio) => {
      renderController({ aspectRatio });
      const props = getRenderedCropFieldProps();
      expect(props.aspectRatio).toEqual(aspectRatio);
      expect(props.labels.emptyDescription).toBe('');
      expect(props.labels.constraints).toBeUndefined();
      expect(props.labels.constraintsLabel).toBeUndefined();
      expect(props.labels.changeHint).toBeUndefined();
    },
  );

  it('filters artwork selection to its supported source formats without rejecting by original byte size', () => {
    renderController({ uploadType: UploadType.RELEASE_ARTWORK, aspectRatio: 1 });
    const props = getRenderedCropFieldProps();
    expect(props.accept).toHaveProperty('image/heic');
    expect(props.accept).toHaveProperty('image/png');
    expect(props.accept).not.toHaveProperty('image/gif');
    expect(props.maxSize).toBeUndefined();
  });
});
