import { randomTestUuid } from '@echovisionlab/geul-common/test/random-id';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFileStatusesAction } from '@/lib/actions/file';
import type { EditorFileStatusSnapshot } from './editor-file-status-runtime';
import { getEditorFileStatus } from './use-editor-file-status-bootstrap';

vi.mock('@/lib/actions/file', () => ({
  getFileStatusesAction: vi.fn(),
}));

function readyAudio(fileId: string): EditorFileStatusSnapshot {
  return {
    mimeType: 'audio/wav',
    completed: true,
    failed: false,
    unavailable: false,
    url: `https://cdn.example.test/${fileId}.wav`,
    originalUrl: `https://cdn.example.test/${fileId}.wav`,
    waveformUrl: `https://cdn.example.test/${fileId}.json`,
    spectrogramUrl: '',
    thumbnailUrl: '',
    hlsUrl: `https://cdn.example.test/${fileId}.m3u8`,
    durationSeconds: 3685,
    processingStatus: MediaProcessingStatus.READY,
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.mocked(getFileStatusesAction).mockReset();
});

describe('getEditorFileStatus', () => {
  it('fetches the statuses of files requested in the same tick with one call and resolves each its own', async () => {
    vi.useFakeTimers();
    const fileIds = Array.from({ length: 5 }, () => randomTestUuid());
    const statuses = Object.fromEntries(fileIds.map((fileId) => [fileId, readyAudio(fileId)]));
    vi.mocked(getFileStatusesAction).mockResolvedValue(statuses);

    const results = Promise.all(fileIds.map((fileId) => getEditorFileStatus(fileId)));
    expect(getFileStatusesAction).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();
    await expect(results).resolves.toEqual(fileIds.map((fileId) => statuses[fileId]));
    expect(getFileStatusesAction).toHaveBeenCalledOnce();
    expect(new Set(vi.mocked(getFileStatusesAction).mock.calls[0]?.[0])).toEqual(new Set(fileIds));
  });
});
