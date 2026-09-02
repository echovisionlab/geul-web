import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileDownloadAction, FileDownloadAvailability } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { POST } from './route';

const mocks = vi.hoisted(() => ({ getReleasePublic: vi.fn() }));

vi.mock('@/lib/queries/release', () => ({ getReleasePublic: mocks.getReleasePublic }));

function request(body: Record<string, unknown>) {
  return new Request('http://localhost/api/release/media-download', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/release/media-download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getReleasePublic.mockResolvedValue({
      tracks: [
        {
          id: 'track-1',
          fileId: 'file-1',
          downloadAvailability: FileDownloadAvailability.AVAILABLE,
          downloadAction: FileDownloadAction.DOWNLOAD,
          downloadUrl: 'https://cdn.example/download',
        },
      ],
    });
  });

  it('re-reads the owning Release with the in-memory share credential', async () => {
    const response = await POST(
      request({
        idOrSlug: 'release-1',
        trackId: 'track-1',
        requestedLocale: 'ko',
        shareToken: 'share-token',
        sharePassword: 'secret',
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.getReleasePublic).toHaveBeenCalledWith('release-1', 'share-token', {
      requestedLocale: 'ko',
      sharePassword: 'secret',
      hydrateWaveformData: false,
    });
    await expect(response.json()).resolves.toEqual({
      access: {
        availability: FileDownloadAvailability.AVAILABLE,
        action: FileDownloadAction.DOWNLOAD,
      },
      download: { url: 'https://cdn.example/download' },
    });
  });

  it('rejects a Track relation that is not in the current Release', async () => {
    const response = await POST(request({ idOrSlug: 'release-1', trackId: 'other-track' }));

    expect(response.status).toBe(404);
  });
});
