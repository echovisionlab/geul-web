// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageUploadCropFieldProps, ImageUploadRejectionReason } from '@/components/core/ImageUpload';
import { ImageUploadCropController } from './ImageUploadCropController';

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
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function renderController() {
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
