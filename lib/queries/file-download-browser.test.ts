import { PublicMediaEntityType } from '@echovisionlab/geul-proto/public/file_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicFileClient } from '@/lib/api/browser-client';
import { authorizeFileDownload } from './file-download-browser';

vi.mock('@/lib/api/browser-client', () => ({ createPublicFileClient: vi.fn() }));

describe('authorizeFileDownload', () => {
  const authorizeDownload = vi.fn();

  beforeEach(() => {
    authorizeDownload.mockReset();
    vi.mocked(createPublicFileClient).mockReturnValue({ authorizeDownload } as never);
  });

  it('sends an exact Content Block relation target without a caller File identity', async () => {
    authorizeDownload.mockResolvedValue({});

    await authorizeFileDownload({
      entityType: PublicMediaEntityType.POST,
      entityId: 'post-1',
      selector: { blockId: 'block-1', referencePath: 'file' },
    });

    expect(authorizeDownload).toHaveBeenCalledWith({
      entityType: PublicMediaEntityType.POST,
      entityId: 'post-1',
      relationTarget: {
        case: 'contentBlock',
        value: expect.objectContaining({ blockId: 'block-1', referencePath: 'file' }),
      },
    });
  });

  it('sends a Release Track relation target and rejects ambiguous targets', async () => {
    authorizeDownload.mockResolvedValue({});

    await authorizeFileDownload({
      entityType: PublicMediaEntityType.RELEASE,
      entityId: 'release-1',
      trackId: 'track-1',
    });
    expect(authorizeDownload).toHaveBeenCalledWith({
      entityType: PublicMediaEntityType.RELEASE,
      entityId: 'release-1',
      relationTarget: { case: 'trackId', value: 'track-1' },
    });

    await expect(
      authorizeFileDownload({
        entityType: PublicMediaEntityType.RELEASE,
        entityId: 'release-1',
        selector: { blockId: 'block-1', referencePath: 'file' },
        trackId: 'track-1',
      }),
    ).rejects.toThrow(/Exactly one/u);
  });
});
