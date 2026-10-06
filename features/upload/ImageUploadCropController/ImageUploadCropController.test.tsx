// @vitest-environment jsdom

import { act } from 'react';
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
    tempImageSrc: null,
    cropModalOpened: false,
    handleFileDrop: handleFileDropMock,
    handleCropComplete: handleCropCompleteMock,
    handleCropCancel: handleCropCancelMock,
  }),
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationShowMock },
}));

vi.mock('next-intl', () => ({
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
        color: 'red',
      });
    },
  );
});

describe('ImageUploadCropController aspect ratio', () => {
  it('defaults to a 16:9 crop and matching upload instruction', () => {
    renderController();
    const props = getRenderedCropFieldProps();
    expect(props.aspectRatio).toBe(16 / 9);
    expect(props.labels.emptyDescription).toContain('featuredImage.empty.editable: 16:9');
  });

  it.each([
    [16 / 9, '16:9'],
    [1, '1:1'],
    [4 / 3, '4:3'],
    [9 / 16, '9:16'],
    [1200 / 630, '40:21'],
    [1.234, '1.234:1'],
  ])('describes the actual numeric crop %s as %s', (aspectRatio, expected) => {
    renderController({ aspectRatio });
    expect(getRenderedCropFieldProps().labels.emptyDescription).toContain(`featuredImage.empty.editable: ${expected}`);
  });

  it('describes both range bounds without rounding them', () => {
    renderController({ aspectRatio: { min: 9 / 16, max: 1.234 } });
    expect(getRenderedCropFieldProps().labels.emptyDescription).toContain('featuredImage.empty.editable: 9:16-1.234:1');
  });

  it('omits a fixed-ratio instruction for a free crop', () => {
    renderController({ aspectRatio: 'free' });
    expect(getRenderedCropFieldProps().labels.emptyDescription).not.toContain('featuredImage.empty.editable');
  });
});
