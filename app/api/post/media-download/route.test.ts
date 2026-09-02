import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getPostView: vi.fn(),
  getPostViewWithToken: vi.fn(),
}));

vi.mock('@/lib/queries/post', () => ({
  getPostView: mocks.getPostView,
  getPostViewWithToken: mocks.getPostViewWithToken,
}));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/post/media-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const post = {
  blockMedia: [
    {
      selector: { blockId: 'attachment-1', referencePath: 'file' },
      attachment: { state: { case: 'activeFileId', value: 'file-1' } },
      downloadAvailability: FileDownloadAvailability.AVAILABLE,
      downloadAction: FileDownloadAction.DOWNLOAD,
      delivery: { download: { url: 'https://signed.example/original.pdf' } },
    },
  ],
};

describe('POST /api/post/media-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPostView.mockResolvedValue(post);
    mocks.getPostViewWithToken.mockResolvedValue(post);
  });

  it('re-reads the owning Post with the in-memory share credential and returns its original ref', async () => {
    const response = await POST(
      request({
        idOrSlug: 'shared-post',
        requestedLocale: 'ko',
        shareToken: 'share-token',
        sharePassword: 'secret',
        selector: { blockId: 'attachment-1', referencePath: 'file' },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://signed.example/original.pdf' },
    });
    expect(mocks.getPostViewWithToken).toHaveBeenCalledWith('shared-post', 'share-token', 'ko', 'secret');
    expect(mocks.getPostView).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('returns not found when the current Post no longer links the file', async () => {
    mocks.getPostView.mockResolvedValue({ blockMedia: [] });
    const response = await POST(
      request({ idOrSlug: 'post-1', selector: { blockId: 'attachment-1', referencePath: 'file' } }),
    );
    expect(response.status).toBe(404);
    expect(mocks.getPostView).toHaveBeenCalledWith('post-1', { requestedLocale: undefined });
  });

  it('keeps separate decisions when the same File is attached to two Blocks', async () => {
    mocks.getPostView.mockResolvedValue({
      blockMedia: [
        {
          ...post.blockMedia[0],
          selector: { blockId: 'disabled-block', referencePath: 'file' },
          downloadAvailability: FileDownloadAvailability.UNAVAILABLE,
          downloadAction: FileDownloadAction.NONE,
          delivery: undefined,
        },
        {
          ...post.blockMedia[0],
          selector: { blockId: 'public-block', referencePath: 'file' },
        },
      ],
    });

    const response = await POST(
      request({ idOrSlug: 'post-1', selector: { blockId: 'public-block', referencePath: 'file' } }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        access: {
          availability: FileDownloadAvailability.AVAILABLE,
          action: FileDownloadAction.DOWNLOAD,
        },
      }),
    );
  });
});
