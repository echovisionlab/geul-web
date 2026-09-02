// @vitest-environment jsdom

import { act } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageFeaturedImageUploader } from './PageFeaturedImageUploader';

const uploadMock = vi.fn();
const setPageFeaturedImageActionMock = vi.fn();
const removePageFeaturedImageActionMock = vi.fn();

let uploadHandler: ((blob: Blob) => void | Promise<void>) | null = null;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (vars: any) => Promise<any>;
    onSuccess?: (result: any) => void;
  }) => ({
    mutateAsync: async (vars: any) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      return result;
    },
    mutate: async (vars?: any) => {
      const result = await mutationFn(vars);
      onSuccess?.(result);
      return result;
    },
    isPending: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}));

vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({ onUpload }: { onUpload: (blob: Blob) => void | Promise<void> }) => {
    uploadHandler = onUpload;
    return <div data-testid="featured-image-uploader" />;
  },
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({
    upload: uploadMock,
    isUploading: false,
  }),
}));

vi.mock('@/lib/actions/page', () => ({
  setPageFeaturedImageAction: (...args: any[]) => setPageFeaturedImageActionMock(...args),
  removePageFeaturedImageAction: (...args: any[]) => removePageFeaturedImageActionMock(...args),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  uploadMock.mockResolvedValue({ fileId: 'file-1', url: '/media/page/featured/file-1.webp' });
  setPageFeaturedImageActionMock.mockResolvedValue({
    imageUrl: '/media/page/featured/file-1.webp',
    ogGenerationRunId: 'page-og-run',
  });
  removePageFeaturedImageActionMock.mockResolvedValue({ success: true });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
  uploadHandler = null;
  uploadMock.mockReset();
  setPageFeaturedImageActionMock.mockReset();
  removePageFeaturedImageActionMock.mockReset();
});

describe('PageFeaturedImageUploader', () => {
  it('marks featured uploads as page-scoped for backend-owned key and permission policy', async () => {
    const onImageUrlChange = vi.fn();
    const onOgGenerationRequested = vi.fn();

    act(() => {
      root?.render(
        <PageFeaturedImageUploader
          pageId="2b70254e-924d-4605-9eb2-b4d6e8fdc3e6"
          imageUrl={null}
          onImageUrlChange={onImageUrlChange}
          onOgGenerationRequested={onOgGenerationRequested}
          canEdit
        />,
      );
    });

    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(uploadMock).toHaveBeenCalledWith(expect.any(Blob), {
      entityId: '2b70254e-924d-4605-9eb2-b4d6e8fdc3e6',
      entityType: TranscodeEntityType.PAGE,
      fileName: 'featured',
      onProgress: expect.any(Function),
    });
    expect(setPageFeaturedImageActionMock).toHaveBeenCalledWith('2b70254e-924d-4605-9eb2-b4d6e8fdc3e6', 'file-1');
    expect(onImageUrlChange).toHaveBeenCalledWith('/media/page/featured/file-1.webp');
    expect(onOgGenerationRequested).toHaveBeenCalledWith('page-og-run');
  });
});
