import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getPageView: vi.fn(),
  getPageViewWithToken: vi.fn(),
}));

vi.mock('@/lib/queries/page', () => ({
  getPageView: mocks.getPageView,
  getPageViewWithToken: mocks.getPageViewWithToken,
}));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/page/media-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const page = {
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

describe('POST /api/page/media-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPageView.mockResolvedValue(page);
    mocks.getPageViewWithToken.mockResolvedValue(page);
  });

  it('re-reads the owning Page with the in-memory share credential and returns its original ref', async () => {
    const response = await POST(
      request({
        idOrSlug: 'shared-page',
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
    expect(mocks.getPageViewWithToken).toHaveBeenCalledWith('shared-page', 'share-token', 'ko', 'secret');
    expect(mocks.getPageView).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('returns not found when the current Page no longer links the file', async () => {
    mocks.getPageView.mockResolvedValue({ blockMedia: [] });

    const response = await POST(
      request({ idOrSlug: 'page-1', selector: { blockId: 'attachment-1', referencePath: 'file' } }),
    );

    expect(response.status).toBe(404);
    expect(mocks.getPageView).toHaveBeenCalledWith('page-1', { requestedLocale: undefined });
  });
});
