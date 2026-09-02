// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useImageUploadCrop } from './useImageUploadCrop';

const { prepareImageFileForPreviewMock, notificationShowMock } = vi.hoisted(() => ({
  prepareImageFileForPreviewMock: vi.fn(),
  notificationShowMock: vi.fn(),
}));

vi.mock('@/lib/utils/upload-pipeline', () => ({
  prepareImageFileForPreview: prepareImageFileForPreviewMock,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationShowMock },
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: FileReader['onload'] = null;

  readAsDataURL(file: Blob) {
    this.result = `data:${file.type};base64,preview`;
    this.onload?.call(this as unknown as FileReader, { target: this } as unknown as ProgressEvent<FileReader>);
  }
}

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let currentHook: ReturnType<typeof useImageUploadCrop> | null = null;

function HookHarness({ onUpload }: { onUpload: (blob: Blob) => void }) {
  currentHook = useImageUploadCrop({
    onUpload,
    uploadType: UploadType.FEATURED_IMAGE,
  });

  return (
    <output data-crop-open={String(currentHook.cropModalOpened)} data-image-src={currentHook.tempImageSrc ?? ''} />
  );
}

function getCurrentHook(): ReturnType<typeof useImageUploadCrop> {
  if (!currentHook) {
    throw new Error('Expected the upload crop hook to be rendered');
  }
  return currentHook;
}

async function selectFile(file: File) {
  await act(async () => {
    getCurrentHook().handleFileDrop([file]);
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal('FileReader', MockFileReader);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  currentHook = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  currentHook = null;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('useImageUploadCrop', () => {
  it('preprocesses a file, opens the crop session from FileReader, and resets after completion', async () => {
    const onUpload = vi.fn();
    const sourceFile = new File(['source'], 'source.png', { type: 'image/png' });
    const previewFile = new File(['preview'], 'preview.webp', { type: 'image/webp' });
    const croppedBlob = new Blob(['cropped'], { type: 'image/webp' });
    prepareImageFileForPreviewMock.mockResolvedValue(previewFile);

    act(() => root.render(<HookHarness onUpload={onUpload} />));
    await selectFile(sourceFile);

    expect(prepareImageFileForPreviewMock).toHaveBeenCalledWith(sourceFile, UploadType.FEATURED_IMAGE);
    expect(getCurrentHook().tempImageSrc).toBe('data:image/webp;base64,preview');
    expect(getCurrentHook().cropModalOpened).toBe(true);

    act(() => getCurrentHook().handleCropComplete(croppedBlob));

    expect(onUpload).toHaveBeenCalledWith(croppedBlob);
    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });

  it('closes and clears an active crop session when cancelled', async () => {
    const previewFile = new File(['preview'], 'preview.webp', { type: 'image/webp' });
    prepareImageFileForPreviewMock.mockResolvedValue(previewFile);

    act(() => root.render(<HookHarness onUpload={vi.fn()} />));
    await selectFile(new File(['source'], 'source.png', { type: 'image/png' }));
    expect(getCurrentHook().cropModalOpened).toBe(true);

    act(() => getCurrentHook().handleCropCancel());

    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });

  it('reports preprocessing failures without opening a crop session', async () => {
    prepareImageFileForPreviewMock.mockRejectedValue(new Error('Could not prepare image'));

    act(() => root.render(<HookHarness onUpload={vi.fn()} />));
    await selectFile(new File(['source'], 'source.png', { type: 'image/png' }));

    expect(notificationShowMock).toHaveBeenCalledWith({
      message: 'Could not prepare image',
      color: 'red',
    });
    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });
});
