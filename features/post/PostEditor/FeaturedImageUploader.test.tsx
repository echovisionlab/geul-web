// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FeaturedImageUploader } from './FeaturedImageUploader';

const { notificationShowMock, setFeaturedImageActionMock, setFeaturedImageMock, uploadMock } = vi.hoisted(() => ({
  notificationShowMock: vi.fn(),
  setFeaturedImageActionMock: vi.fn(),
  setFeaturedImageMock: vi.fn(),
  uploadMock: vi.fn(),
}));

let uploadHandler: ((blob: Blob) => void | Promise<void>) | null = null;
let uploaderCanEdit = false;
let container: HTMLDivElement | null = null;
let root: Root | null = null;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

vi.mock('@tanstack/react-query', () => ({
  useMutation: ({
    mutationFn,
    onSuccess,
  }: {
    mutationFn: (variables: unknown) => Promise<unknown>;
    onSuccess?: (result: unknown, variables: unknown) => void;
  }) => ({
    mutateAsync: async (variables: unknown) => {
      const result = await mutationFn(variables);
      onSuccess?.(result, variables);
      return result;
    },
    mutate: async (variables?: unknown) => {
      const result = await mutationFn(variables);
      onSuccess?.(result, variables);
      return result;
    },
    isPending: false,
  }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('@mantine/notifications', () => ({
  notifications: { show: notificationShowMock },
}));

vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({
    canEdit,
    onUpload,
  }: {
    canEdit: boolean;
    onUpload: (blob: Blob) => void | Promise<void>;
  }) => {
    uploaderCanEdit = canEdit;
    uploadHandler = onUpload;
    return <div />;
  },
}));

vi.mock('@/lib/actions/post', () => ({
  setPostFeaturedImageAction: (...args: unknown[]) => setFeaturedImageActionMock(...args),
  removePostFeaturedImageAction: vi.fn(),
}));

vi.mock('@/lib/contexts/PostMetaContext', () => ({
  usePostMeta: () => ({
    featuredImageUrl: null,
    setFeaturedImage: setFeaturedImageMock,
  }),
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ upload: uploadMock, isUploading: false }),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
}));

beforeEach(() => {
  uploadMock.mockResolvedValue({ fileId: 'post-file-id' });
  setFeaturedImageActionMock.mockResolvedValue({
    imageUrl: 'https://example.com/post-cover.jpg',
    ogGenerationRunId: 'post-og-run',
  });
  setFeaturedImageMock.mockReturnValue(true);
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  uploadHandler = null;
  uploaderCanEdit = false;
  uploadMock.mockReset();
  setFeaturedImageActionMock.mockReset();
  setFeaturedImageMock.mockReset();
  notificationShowMock.mockReset();
});

describe('FeaturedImageUploader', () => {
  it('stores the uploaded file ID through the Post action and keeps the URL for display', async () => {
    const onOgGenerationRequested = vi.fn();
    act(() => {
      root?.render(<FeaturedImageUploader postId="post-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />);
    });

    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(setFeaturedImageActionMock).toHaveBeenCalledWith('post-1', 'post-file-id');
    expect(setFeaturedImageMock).toHaveBeenCalledWith('post-file-id', 'https://example.com/post-cover.jpg');
    expect(onOgGenerationRequested).toHaveBeenCalledWith('post-og-run');
  });

  it('does not gate the Post-owned featured image action on collaboration readiness', async () => {
    act(() => {
      root?.render(<FeaturedImageUploader postId="post-1" canEdit />);
    });

    expect(uploaderCanEdit).toBe(true);

    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(uploadMock).toHaveBeenCalledOnce();
    expect(setFeaturedImageActionMock).toHaveBeenCalledWith('post-1', 'post-file-id');
    expect(setFeaturedImageMock).toHaveBeenCalledOnce();
  });

  it('reports a local presentation update failure after the API action succeeds', async () => {
    setFeaturedImageMock.mockReturnValue(false);

    act(() => {
      root?.render(<FeaturedImageUploader postId="post-1" canEdit />);
    });
    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(setFeaturedImageActionMock).toHaveBeenCalledWith('post-1', 'post-file-id');
    expect(setFeaturedImageMock).toHaveBeenCalledWith('post-file-id', 'https://example.com/post-cover.jpg');
    expect(notificationShowMock).toHaveBeenCalledWith({ message: 'updateFailed', color: 'red' });
    expect(notificationShowMock).not.toHaveBeenCalledWith({
      message: 'featuredImageUpdated',
      color: 'green',
    });
  });

  it('does not report success when the API action resolves after unmount', async () => {
    const action = deferred<{ imageUrl: string }>();
    const onOgGenerationRequested = vi.fn();
    setFeaturedImageActionMock.mockReturnValue(action.promise);

    act(() => {
      root?.render(<FeaturedImageUploader postId="post-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />);
    });

    let uploadPromise: Promise<void> | undefined;
    await act(async () => {
      uploadPromise = uploadHandler?.(new Blob(['image'], { type: 'image/webp' })) as Promise<void> | undefined;
      await Promise.resolve();
    });
    expect(setFeaturedImageActionMock).toHaveBeenCalled();

    act(() => root?.render(null));
    setFeaturedImageMock.mockReturnValue(false);

    await act(async () => {
      action.resolve({ imageUrl: 'https://example.com/post-cover.jpg' });
      await uploadPromise;
    });

    expect(notificationShowMock).toHaveBeenCalledWith({ message: 'updateFailed', color: 'red' });
    expect(notificationShowMock).not.toHaveBeenCalledWith({
      message: 'featuredImageUpdated',
      color: 'green',
    });
    expect(onOgGenerationRequested).not.toHaveBeenCalled();
  });
});
