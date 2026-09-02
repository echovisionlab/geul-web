import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileClient } from '@/lib/api/server-client';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import { getFileStatusesAction } from './file';

const getBulkMediaDeliveriesMock = vi.fn();

vi.mock('@/lib/api/server-client', () => ({
  createFileClient: vi.fn(),
}));

beforeEach(() => {
  getBulkMediaDeliveriesMock.mockReset();
  vi.mocked(createFileClient).mockReset();
  vi.mocked(createFileClient).mockResolvedValue({
    getBulkMediaDeliveries: getBulkMediaDeliveriesMock,
  } as unknown as Awaited<ReturnType<typeof createFileClient>>);
});

describe('getFileStatusesAction', () => {
  it('hydrates editor media through bounded bulk delivery calls', async () => {
    const fileIds = Array.from({ length: 201 }, (_, index) => `file-${index + 1}`);
    getBulkMediaDeliveriesMock.mockImplementation(({ fileIds: batch }: { fileIds: string[] }) => ({
      files: Object.fromEntries(
        batch.map((fileId) => [
          fileId,
          {
            delivery: mediaDeliveryFixture({
              fileId,
              mimeType: 'audio/flac',
              playbackUrl: `https://cdn.example.com/${fileId}.m3u8`,
              processingStatus: MediaProcessingStatus.READY,
            }),
          },
        ]),
      ),
    }));

    const statuses = await getFileStatusesAction([...fileIds, 'file-1', '']);

    expect(getBulkMediaDeliveriesMock).toHaveBeenCalledTimes(3);
    expect(getBulkMediaDeliveriesMock.mock.calls.map(([request]) => request.fileIds.length)).toEqual([100, 100, 1]);
    expect(statuses['file-1']).toMatchObject({
      completed: true,
      failed: false,
      hlsUrl: 'https://cdn.example.com/file-1.m3u8',
    });
    expect(Object.keys(statuses)).toHaveLength(201);
  });

  it('keeps a missing delivery terminal while a batch transport failure stays transient', async () => {
    getBulkMediaDeliveriesMock.mockResolvedValueOnce({ files: {} });

    await expect(getFileStatusesAction(['missing-file'])).resolves.toMatchObject({
      'missing-file': {
        completed: false,
        failed: true,
        unavailable: false,
        processingStatus: MediaProcessingStatus.FAILED,
      },
    });

    getBulkMediaDeliveriesMock.mockRejectedValueOnce(new Error('backend unavailable'));

    await expect(getFileStatusesAction(['temporary-file'])).resolves.toMatchObject({
      'temporary-file': {
        completed: false,
        failed: false,
        unavailable: true,
        processingStatus: MediaProcessingStatus.UNSPECIFIED,
      },
    });
  });
});
