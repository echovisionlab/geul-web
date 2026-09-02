// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ImageUploadRejection } from '@/components/core/ImageUpload';
import { ImageDropzone } from './ImageDropzone';

const { notificationShowMock, getViewProps, setViewProps } = vi.hoisted(() => {
  let viewProps: {
    onFileSelect: (file: File) => void;
    onReject: (rejections: ImageUploadRejection[]) => void;
  } | null = null;

  return {
    notificationShowMock: vi.fn(),
    getViewProps: () => viewProps,
    setViewProps: (value: typeof viewProps) => {
      viewProps = value;
    },
  };
});

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationShowMock },
}));

vi.mock('./ui/ImageDropzoneView', () => ({
  ImageDropzoneView: (props: {
    onFileSelect: (file: File) => void;
    onReject: (rejections: ImageUploadRejection[]) => void;
  }) => {
    setViewProps(props);
    return <div data-testid="image-dropzone-view" data-props={String(Boolean(props))} />;
  },
}));

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
  notificationShowMock.mockReset();
  setViewProps(null);
});

describe('ImageDropzone rejection policy', () => {
  it('keeps minimum-size and rejection notifications in the controller', () => {
    const onDrop = vi.fn();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <ImageDropzone
          currentUrl={null}
          uploading={false}
          deleting={false}
          accept={['image/png']}
          minSize={1024}
          maxSize={2048}
          previewHeight={100}
          previewWidth={100}
          label="Asset"
          description="Asset description"
          errorMessage="Unsupported asset"
          onDrop={onDrop}
          onDelete={vi.fn()}
        />,
      );
    });

    const viewProps = getViewProps();
    expect(viewProps).not.toBeNull();
    if (!viewProps) {
      throw new Error('Expected ImageDropzone to render its view');
    }

    act(() => viewProps.onFileSelect(new File(['x'.repeat(100)], 'small.png', { type: 'image/png' })));
    expect(onDrop).not.toHaveBeenCalled();
    expect(notificationShowMock).toHaveBeenCalledWith({
      message: 'File too small. Minimum size: 1 KB',
      color: 'red',
    });

    act(() =>
      viewProps.onReject([
        {
          file: new File(['x'.repeat(4096)], 'large.png', { type: 'image/png' }),
          reason: 'too-large',
        },
      ]),
    );
    expect(notificationShowMock).toHaveBeenLastCalledWith({
      message: 'File too large. Maximum size: 2 KB',
      color: 'red',
    });

    const validFile = new File(['x'.repeat(1500)], 'valid.png', { type: 'image/png' });
    act(() => viewProps.onFileSelect(validFile));
    expect(onDrop).toHaveBeenCalledWith([validFile]);
  });
});
