import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  getWorkView: vi.fn(),
  getWorkViewWithShareToken: vi.fn(),
}));

vi.mock('@/lib/queries/work', () => ({
  getWorkView: mocks.getWorkView,
  getWorkViewWithShareToken: mocks.getWorkViewWithShareToken,
}));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/work/media-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const work = {
  blockMedia: [
    {
      selector: { blockId: 'image-block', referencePath: 'file' },
      attachment: { state: { case: 'activeFileId', value: 'file-1' } },
      downloadAvailability: FileDownloadAvailability.AVAILABLE,
      downloadAction: FileDownloadAction.DOWNLOAD,
      delivery: { download: { url: 'https://signed.example/original.png' } },
    },
  ],
};

describe('POST /api/work/media-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getWorkView.mockResolvedValue(work);
    mocks.getWorkViewWithShareToken.mockResolvedValue(work);
  });

  it('re-reads the exact Work Block relation with the in-memory share credential', async () => {
    const response = await POST(
      request({
        idOrSlug: 'shared-work',
        requestedLocale: 'ko',
        shareToken: 'share-token',
        sharePassword: 'secret',
        selector: { blockId: 'image-block', referencePath: 'file' },
      }),
    );

    expect(mocks.getWorkViewWithShareToken).toHaveBeenCalledWith('shared-work', 'share-token', 'ko', 'secret');
    expect(mocks.getWorkView).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://signed.example/original.png' },
    });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('does not return a File for a different relation selector', async () => {
    const response = await POST(
      request({ idOrSlug: 'work-1', selector: { blockId: 'other-block', referencePath: 'file' } }),
    );

    expect(response.status).toBe(404);
    expect(mocks.getWorkView).toHaveBeenCalledWith('work-1', { requestedLocale: undefined });
  });
});
