// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { notifications } from '@/components/core/Notification';
import { act, render } from '@/test/render';
import { WorkFeaturedImageUploader } from './WorkFeaturedImageUploader';

const mocks = vi.hoisted(() => ({ upload: vi.fn(), setImage: vi.fn(), setAction: vi.fn() }));
let uploadHandler: ((blob: Blob) => void | Promise<void>) | null = null;
vi.mock('@/features/upload/ImageUploadCropController', () => ({
  ImageUploadCropController: ({ onUpload }: { onUpload: typeof uploadHandler }) => {
    uploadHandler = onUpload;
    return null;
  },
}));
vi.mock('@/lib/actions/work', () => ({
  setWorkFeaturedImageAction: mocks.setAction,
  removeWorkFeaturedImageAction: vi.fn(),
}));
vi.mock('@/lib/contexts/WorkMetaContext', () => ({
  useWorkMeta: () => ({
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

it('stores the uploaded file ID through the Work action and keeps the URL for display', async () => {
  mocks.upload.mockResolvedValue({ fileId: 'work-file-id' });
  mocks.setAction.mockResolvedValue({
    imageUrl: 'https://example.com/work-cover.jpg',
    ogGenerationRunId: 'work-og-run',
  });
  mocks.setImage.mockReturnValue(true);
  const onOgGenerationRequested = vi.fn();
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const { unmount } = render(
    <QueryClientProvider client={client}>
      <WorkFeaturedImageUploader workId="work-1" canEdit onOgGenerationRequested={onOgGenerationRequested} />
    </QueryClientProvider>,
  );
  try {
    expect(uploadHandler).toBeTypeOf('function');
    await act(async () => {
      await uploadHandler!(new Blob(['image'], { type: 'image/webp' }));
    });
    expect(mocks.setAction).toHaveBeenCalledWith('work-1', 'work-file-id');
    expect(mocks.setImage).toHaveBeenCalledWith('work-file-id', 'https://example.com/work-cover.jpg');
    expect(onOgGenerationRequested).toHaveBeenCalledWith('work-og-run');
  } finally {
    unmount();
    client.clear();
  }
});
