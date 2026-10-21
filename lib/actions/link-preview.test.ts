import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, expect, it, vi } from 'vitest';
import { getLinkPreviewAction } from './link-preview';

const mocks = vi.hoisted(() => ({ getLinkPreview: vi.fn() }));

vi.mock('@/lib/api/server-client', () => ({
  createLinkPreviewClient: async () => ({ getLinkPreview: mocks.getLinkPreview }),
}));
vi.mock('@/lib/logging/logger', () => ({ logServerFailure: vi.fn() }));

beforeEach(() => vi.clearAllMocks());

it('returns the preview a page declares, including the image and icon sources to import', async () => {
  mocks.getLinkPreview.mockResolvedValue({
    resolvedUrl: 'https://www.example.com/video',
    title: 'A video',
    description: 'Live set',
    siteName: 'Video Site',
    imageSource: 'https://i.example.com/v.jpg',
    iconSource: 'https://www.example.com/favicon.ico',
  });

  await expect(getLinkPreviewAction('https://example.com/watch')).resolves.toEqual({
    ok: true,
    preview: {
      resolvedUrl: 'https://www.example.com/video',
      title: 'A video',
      description: 'Live set',
      siteName: 'Video Site',
      imageSource: 'https://i.example.com/v.jpg',
      iconSource: 'https://www.example.com/favicon.ico',
    },
  });
  expect(mocks.getLinkPreview).toHaveBeenCalledWith({ url: 'https://example.com/watch' });
});

it('keeps the API reason when the page cannot be read', async () => {
  mocks.getLinkPreview.mockRejectedValue(
    new ConnectError('the linked page returned status 404', Code.FailedPrecondition),
  );

  await expect(getLinkPreviewAction('https://example.com/missing')).resolves.toMatchObject({
    ok: false,
    errorCode: Code.FailedPrecondition,
  });
});
