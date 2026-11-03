// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import { UploadType } from '@/lib/types/upload/model';
import { TestProviders } from '@/test/TestProviders';
import { act, renderHook, screen, waitFor } from '@/test/render';
import { useFeaturedImageCommands } from './useFeaturedImageCommands';

const upload = vi.hoisted(() => vi.fn());
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload, isUploading: false }) }));
afterEach(() => {
  act(() => notifications.clean());
  upload.mockReset();
});

it('reports a rejected presentation update without success or OG-generation callbacks', async () => {
  upload.mockResolvedValue({ fileId: 'image-file' });
  const setImageAction = vi.fn().mockResolvedValue({ imageUrl: '/cover.webp', ogGenerationRunId: 'og-run' });
  const setImage = vi.fn(() => false);
  const onOgGenerationRequested = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <TestProviders>
        <QueryClientProvider client={client}>
          {children}
          <NotificationRegion closeLabel="Close" />
        </QueryClientProvider>
      </TestProviders>
    );
  }
  const { result, unmount } = renderHook(
    () =>
      useFeaturedImageCommands({
        entityId: 'post-1',
        uploadType: UploadType.FEATURED_IMAGE,
        setImageAction,
        setImage,
        clearImage: vi.fn(),
        removeImageAction: vi.fn(),
        onOgGenerationRequested,
      }),
    { wrapper },
  );
  try {
    await act(async () => {
      await result.current.handleUpload(new Blob(['image'], { type: 'image/webp' }));
    });
    expect(setImageAction).toHaveBeenCalledWith('image-file');
    expect(setImage).toHaveBeenCalledWith('image-file', '/cover.webp');
    expect(await screen.findByText('Update failed')).toBeInTheDocument();
    expect(screen.queryByText('Featured image updated')).not.toBeInTheDocument();
    expect(onOgGenerationRequested).not.toHaveBeenCalled();
  } finally {
    unmount();
    client.clear();
  }
});

it.each(['upload', 'remove'] as const)(
  'keeps %s pending through the save and ignores completion after target changes',
  async (operation) => {
    const save = Promise.withResolvers<{ imageUrl: string; ogGenerationRunId: string }>();
    upload.mockResolvedValue({ fileId: 'image-file' });
    const setImage = vi.fn(() => true);
    const clearImage = vi.fn(() => true);
    const onOgGenerationRequested = vi.fn();
    const setImageAction = vi.fn(() => save.promise);
    const removeImageAction = vi.fn(() => save.promise);
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <TestProviders>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </TestProviders>
    );
    const view = renderHook(
      ({ entityId }) =>
        useFeaturedImageCommands({
          entityId,
          uploadType: UploadType.FEATURED_IMAGE,
          setImage,
          clearImage,
          setImageAction,
          removeImageAction,
          onOgGenerationRequested,
        }),
      { wrapper, initialProps: { entityId: 'one' } },
    );
    let pending!: Promise<unknown>;
    await act(async () => {
      pending =
        operation === 'upload' ? view.result.current.handleUpload(new Blob()) : view.result.current.handleRemove();
    });
    await waitFor(() =>
      expect(operation === 'upload' ? view.result.current.isUploading : view.result.current.isRemoving).toBe(true),
    );
    view.rerender({ entityId: 'two' });
    await act(async () => {
      save.resolve({ imageUrl: '/old.webp', ogGenerationRunId: 'old-run' });
      await pending;
    });
    expect(setImage).not.toHaveBeenCalled();
    expect(clearImage).not.toHaveBeenCalled();
    expect(onOgGenerationRequested).not.toHaveBeenCalled();
    expect(view.result.current.isUploading).toBe(false);
    expect(view.result.current.isRemoving).toBe(false);
    view.unmount();
    client.clear();
  },
);
