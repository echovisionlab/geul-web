// @vitest-environment jsdom

import { act, renderHook } from '@/test/render';
import { notifications } from '@/components/core/Notification';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { useImageUploadCrop } from './useImageUploadCrop';

const { prepareImageFileForPreviewMock } = vi.hoisted(() => ({
  prepareImageFileForPreviewMock: vi.fn(),
}));

vi.mock('@/lib/utils/upload-pipeline', () => ({
  prepareImageFileForPreview: prepareImageFileForPreviewMock,
}));

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: FileReader['onload'] = null;

  readAsDataURL(file: Blob) {
    this.result = `data:${file.type};base64,preview`;
    this.onload?.call(this as unknown as FileReader, { target: this } as unknown as ProgressEvent<FileReader>);
  }
}

let view: ReturnType<
  typeof renderHook<ReturnType<typeof useImageUploadCrop>, { onUpload: (blob: Blob) => void; targetKey: string }>
>;
function mount(onUpload: (blob: Blob) => void = vi.fn()) {
  view = renderHook(
    ({ onUpload, targetKey }) => useImageUploadCrop({ onUpload, targetKey, uploadType: UploadType.FEATURED_IMAGE }),
    { initialProps: { onUpload, targetKey: 'one' } },
  );
}
function getCurrentHook() {
  return view.result.current;
}
async function selectFile(file: File) {
  await act(async () => getCurrentHook().handleFileDrop([file]));
}
beforeEach(() => {
  vi.stubGlobal('FileReader', MockFileReader);
  vi.spyOn(notifications, 'show');
});
afterEach(() => {
  vi.unstubAllGlobals();
  notifications.clean();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('useImageUploadCrop', () => {
  it('preprocesses a file, opens the crop session from FileReader, and resets after completion', async () => {
    const onUpload = vi.fn();
    const sourceFile = new File(['source'], 'source.png', { type: 'image/png' });
    const previewFile = new File(['preview'], 'preview.webp', { type: 'image/webp' });
    const croppedBlob = new Blob(['cropped'], { type: 'image/webp' });
    prepareImageFileForPreviewMock.mockResolvedValue(previewFile);

    mount(onUpload);
    await selectFile(sourceFile);

    expect(prepareImageFileForPreviewMock).toHaveBeenCalledWith(sourceFile, UploadType.FEATURED_IMAGE);
    expect(getCurrentHook().tempImageSrc).toBe('data:image/webp;base64,preview');
    expect(getCurrentHook().cropModalOpened).toBe(true);

    act(() => getCurrentHook().handleCropComplete(croppedBlob));

    expect(onUpload).toHaveBeenCalledWith(croppedBlob);
    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });

  it('exposes preparation state and blocks duplicate selections until local preprocessing completes', async () => {
    let resolvePreparation!: (file: File) => void;
    prepareImageFileForPreviewMock.mockImplementation(
      () =>
        new Promise<File>((resolve) => {
          resolvePreparation = resolve;
        }),
    );
    mount();
    const source = new File(['source'], 'source.png', { type: 'image/png' });
    act(() => getCurrentHook().handleFileDrop([source]));
    expect(getCurrentHook().isPreparing).toBe(true);
    expect(getCurrentHook().cropModalOpened).toBe(false);
    act(() => getCurrentHook().handleFileDrop([source]));
    expect(prepareImageFileForPreviewMock).toHaveBeenCalledOnce();
    await act(async () => resolvePreparation(new File(['preview'], 'preview.webp', { type: 'image/webp' })));
    expect(getCurrentHook().isPreparing).toBe(false);
    expect(getCurrentHook().cropModalOpened).toBe(true);
  });

  it('closes and clears an active crop session when cancelled', async () => {
    const previewFile = new File(['preview'], 'preview.webp', { type: 'image/webp' });
    prepareImageFileForPreviewMock.mockResolvedValue(previewFile);

    mount();
    await selectFile(new File(['source'], 'source.png', { type: 'image/png' }));
    expect(getCurrentHook().cropModalOpened).toBe(true);

    act(() => getCurrentHook().handleCropCancel());

    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });

  it('reports preprocessing failures without opening a crop session', async () => {
    prepareImageFileForPreviewMock.mockRejectedValue(new Error('Could not prepare image'));

    mount();
    await selectFile(new File(['source'], 'source.png', { type: 'image/png' }));

    expect(notifications.show).toHaveBeenCalledWith({
      message: 'Could not prepare image',
      tone: 'danger',
    });
    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(getCurrentHook().cropModalOpened).toBe(false);
  });
});

it.each(['cancel', 'target', 'unmount'] as const)(
  'does not reopen a crop session after %s while preparing',
  async (change) => {
    let complete!: (file: File) => void;
    prepareImageFileForPreviewMock.mockReturnValue(
      new Promise<File>((resolve) => {
        complete = resolve;
      }),
    );
    mount();
    act(() => getCurrentHook().handleFileDrop([new File(['source'], 'source.png', { type: 'image/png' })]));
    expect(getCurrentHook().isPreparing).toBe(true);
    if (change === 'cancel') {
      act(() => getCurrentHook().handleCropCancel());
    } else if (change === 'target') {
      view.rerender({ onUpload: vi.fn(), targetKey: 'two' });
    } else {
      view.unmount();
    }
    await act(async () => complete(new File(['preview'], 'preview.webp', { type: 'image/webp' })));
    expect(getCurrentHook().cropModalOpened).toBe(false);
    expect(getCurrentHook().tempImageSrc).toBeNull();
    expect(notifications.show).not.toHaveBeenCalled();
  },
);
