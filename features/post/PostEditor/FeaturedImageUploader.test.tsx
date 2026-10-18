// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { notifications } from '@/components/core/Notification';
import { act, render } from '@/test/render';
import { FeaturedImageUploader } from './FeaturedImageUploader';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), setImage: vi.fn(), setAction: vi.fn() }));
let uploadHandler: ((blob: Blob) => void | Promise<void>) | null = null;
vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({ onUpload }: { onUpload: typeof uploadHandler }) => {
    uploadHandler = onUpload;
    return null;
  },
}));
vi.mock('@/lib/actions/post', () => ({
  setPostFeaturedImageAction: mocks.setAction,
  removePostFeaturedImageAction: vi.fn(),
}));
vi.mock('@/lib/contexts/PostMetaContext', () => ({
  usePostMeta: () => ({
    featuredImageUrl: null,
    setFeaturedImage: mocks.setImage,
    isConnected: true,
    isSynced: true,
  }),
}));
vi.mock('@/lib/hooks/useUpload', () => ({ useUpload: () => ({ upload: mocks.upload, isUploading: false }) }));
afterEach(() => {
  act(() => notifications.clean());
  vi.clearAllMocks();
  uploadHandler = null;
});

it('stores the uploaded file ID through the Post action and keeps the URL for display', async () => {
  mocks.upload.mockResolvedValue({ fileId: 'post-file-id' });
  mocks.setAction.mockResolvedValue({
    imageUrl: 'https://example.com/post-cover.jpg',
    ogGenerationRunId: 'post-og-run',
  });
  mocks.setImage.mockReturnValue(true);
  const onOgGenerationRequested = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <FeaturedImageUploader postId="post-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />
    </QueryClientProvider>,
  );
  try {
    expect(uploadHandler).toBeTypeOf('function');
    await act(async () => {
      await uploadHandler!(new Blob(['image'], { type: 'image/webp' }));
    });
    expect(mocks.setAction).toHaveBeenCalledWith('post-1', 'post-file-id');
    expect(mocks.setImage).toHaveBeenCalledWith('post-file-id', 'https://example.com/post-cover.jpg');
    expect(onOgGenerationRequested).toHaveBeenCalledWith('post-og-run');
  } finally {
    unmount();
    client.clear();
  }
});
