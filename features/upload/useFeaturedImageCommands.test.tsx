// @vitest-environment jsdom

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { NotificationRegion, notifications } from '@/components/core/Notification';
import { UploadType } from '@/lib/types/upload/model';
import { TestProviders } from '@/test/TestProviders';
import { act, renderHook, screen } from '@/test/render';
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
