// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkFeaturedImageUploader } from './WorkFeaturedImageUploader';

const { notificationShowMock, setFeaturedImageActionMock, setFeaturedImageMock, uploadMock } = vi.hoisted(() => ({
  notificationShowMock: vi.fn(),
  setFeaturedImageActionMock: vi.fn(),
  setFeaturedImageMock: vi.fn(),
  uploadMock: vi.fn(),
}));

let uploadHandler: ((blob: Blob) => void | Promise<void>) | null = null;
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
  ImageUploadCropController: ({ onUpload }: { onUpload: (blob: Blob) => void | Promise<void> }) => {
    uploadHandler = onUpload;
    return <div />;
  },
}));

vi.mock('@/lib/actions/work', () => ({
  setWorkFeaturedImageAction: (...args: unknown[]) => setFeaturedImageActionMock(...args),
  removeWorkFeaturedImageAction: vi.fn(),
}));

vi.mock('@/lib/contexts/WorkMetaContext', () => ({
  useWorkMeta: () => ({
    featuredImageUrl: null,
    setFeaturedImage: setFeaturedImageMock,
    isConnected: true,
    isSynced: true,
  }),
}));

vi.mock('@/lib/hooks/useUpload', () => ({
  useUpload: () => ({ upload: uploadMock, isUploading: false }),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
}));

beforeEach(() => {
  uploadMock.mockResolvedValue({ fileId: 'work-file-id' });
  setFeaturedImageActionMock.mockResolvedValue({
    imageUrl: 'https://example.com/work-cover.jpg',
    ogGenerationRunId: 'work-og-run',
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
  uploadMock.mockReset();
  setFeaturedImageActionMock.mockReset();
  setFeaturedImageMock.mockReset();
  notificationShowMock.mockReset();
});

describe('WorkFeaturedImageUploader', () => {
  it('stores the uploaded file ID in collaboration and keeps the URL for display', async () => {
    const onOgGenerationRequested = vi.fn();
    act(() => {
      root?.render(
        <WorkFeaturedImageUploader workId="work-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />,
      );
    });

    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(setFeaturedImageActionMock).toHaveBeenCalledWith('work-1', 'work-file-id');
    expect(setFeaturedImageMock).toHaveBeenCalledWith('work-file-id', 'https://example.com/work-cover.jpg');
    expect(onOgGenerationRequested).toHaveBeenCalledWith('work-og-run');
  });

  it('does not report success when the durable collaboration write is incomplete', async () => {
    setFeaturedImageMock.mockReturnValue(false);

    act(() => {
      root?.render(<WorkFeaturedImageUploader workId="work-1" canEdit />);
    });
    await act(async () => {
      await uploadHandler?.(new Blob(['image'], { type: 'image/webp' }));
    });

    expect(setFeaturedImageActionMock).toHaveBeenCalledWith('work-1', 'work-file-id');
    expect(setFeaturedImageMock).toHaveBeenCalledWith('work-file-id', 'https://example.com/work-cover.jpg');
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
      root?.render(
        <WorkFeaturedImageUploader workId="work-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />,
      );
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
      action.resolve({ imageUrl: 'https://example.com/work-cover.jpg' });
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
