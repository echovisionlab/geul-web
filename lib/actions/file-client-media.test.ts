import { Code, ConnectError } from '@connectrpc/connect';
import { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import { ClientMediaKind, FileDerivativeType, UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileClient } from '@/lib/api/server-client';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import {
  completeUploadAction,
  completeClientMediaUploadAction,
  findMultipartUploadCandidateAction,
  prepareClientMediaUploadAction,
  recoverCompletedUploadAction,
  recoverCompletedClientMediaUploadAction,
} from './file';

vi.mock('@/lib/api/server-client', () => ({ createFileClient: vi.fn() }));
const prepare = vi.fn();
const complete = vi.fn();
const delivery = vi.fn();
const candidate = vi.fn();
const identity = {
  fileId: 'file-1',
  uploadId: 'upload-1',
  clientMediaBundleId: 'bundle-1',
  uploadType: UploadType.EDITOR_AUDIO,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createFileClient).mockResolvedValue({
    prepareClientMediaUpload: prepare,
    completeMultipartUpload: complete,
    getMediaDelivery: delivery,
    findMultipartUploadCandidate: candidate,
  } as unknown as Awaited<ReturnType<typeof createFileClient>>);
});
function readyDelivery(overrides = {}) {
  return mediaDeliveryFixture({
    fileId: identity.fileId,
    mimeType: 'audio/wav',
    processingStatus: MediaProcessingStatus.READY,
    downloadUrl: '/original',
    playbackUrl: '/master.m3u8',
    waveformUrl: '/waveform',
    spectrogramUrl: '/spectrogram',
    ...overrides,
  });
}

describe('client media upload actions', () => {
  it('converts the immutable manifest to protobuf types and returns the bundle identity', async () => {
    prepare.mockResolvedValue({ bundleId: 'bundle-1' });
    const artifact = {
      path: 'master.m3u8',
      mimeType: 'application/vnd.apple.mpegurl',
      size: 12,
      sha256: 'hash',
      derivativeType: FileDerivativeType.HLS,
    };
    await expect(
      prepareClientMediaUploadAction({
        fileId: 'file-1',
        uploadId: 'upload-1',
        kind: 'audio',
        durationSeconds: 2,
        artifacts: [artifact],
      }),
    ).resolves.toEqual({ ok: true, bundleId: 'bundle-1' });
    expect(prepare).toHaveBeenCalledWith({
      fileId: 'file-1',
      uploadId: 'upload-1',
      kind: ClientMediaKind.AUDIO,
      durationSeconds: 2,
      artifacts: [{ ...artifact, size: 12n }],
    });
  });

  it('returns typed errors for an unauthorized plan', async () => {
    prepare.mockRejectedValue(new ConnectError('unauthorized', Code.Unauthenticated));
    await expect(
      prepareClientMediaUploadAction({
        fileId: 'file-1',
        uploadId: 'upload-1',
        kind: 'audio',
        durationSeconds: 2,
        artifacts: [
          { path: 'master.m3u8', mimeType: 'x', size: 1, sha256: 'x', derivativeType: FileDerivativeType.HLS },
        ],
      }),
    ).resolves.toMatchObject({ ok: false, error: 'Unauthorized', errorCode: Code.Unauthenticated });
  });

  it('passes the bundle identity to completion and exact candidate resume', async () => {
    complete.mockResolvedValue({ fileId: identity.fileId, delivery: readyDelivery() });
    await completeUploadAction(identity);
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ clientMediaBundleId: 'bundle-1' }));
    candidate.mockResolvedValue({ uploadId: 'upload-1', uploadedParts: [], clientMediaBundleId: 'bundle-1' });
    await expect(findMultipartUploadCandidateAction({ ...identity, entityId: '' })).resolves.toMatchObject({
      clientMediaBundleId: 'bundle-1',
    });
  });

  it('recovers a lost ACK only for the same ready bundle with every required artifact', async () => {
    complete.mockRejectedValue(new ConnectError('lost ACK', Code.Unavailable));
    delivery.mockResolvedValue({ clientMediaBundleId: 'bundle-1', delivery: readyDelivery() });
    await expect(recoverCompletedUploadAction(identity)).resolves.toEqual({ fileId: 'file-1', url: '/master.m3u8' });
    expect(complete).toHaveBeenCalledWith(expect.objectContaining({ clientMediaBundleId: 'bundle-1' }));
  });

  it.each([
    { clientMediaBundleId: 'different', delivery: readyDelivery() },
    { clientMediaBundleId: 'bundle-1', delivery: readyDelivery({ fileId: 'different' }) },
    { clientMediaBundleId: 'bundle-1', delivery: readyDelivery({ downloadUrl: undefined }) },
    { clientMediaBundleId: 'bundle-1', delivery: readyDelivery({ waveformUrl: undefined }) },
    { clientMediaBundleId: 'bundle-1', delivery: readyDelivery({ spectrogramUrl: undefined }) },
    {
      clientMediaBundleId: 'bundle-1',
      delivery: readyDelivery({ playbackUrl: undefined }),
    },
    {
      clientMediaBundleId: 'bundle-1',
      delivery: readyDelivery({ processingStatus: MediaProcessingStatus.PROCESSING }),
    },
  ])('does not accept mismatched or incomplete delivery %#', async (response) => {
    const error = new ConnectError('lost ACK', Code.Unavailable);
    complete.mockRejectedValue(error);
    delivery.mockResolvedValue(response);
    await expect(recoverCompletedUploadAction(identity)).rejects.toBe(error);
  });

  it.each([true, false])('requires the video thumbnail when recovering a lost ACK (present: %s)', async (thumbnail) => {
    const error = new ConnectError('lost ACK', Code.Unavailable);
    complete.mockRejectedValue(error);
    delivery.mockResolvedValue({
      clientMediaBundleId: identity.clientMediaBundleId,
      delivery: readyDelivery({
        mimeType: 'video/mp4',
        thumbnailUrl: thumbnail ? '/thumbnail' : undefined,
        waveformUrl: undefined,
        spectrogramUrl: undefined,
      }),
    });
    const recovery = recoverCompletedUploadAction({ ...identity, uploadType: UploadType.EDITOR_VIDEO });
    if (thumbnail) {
      await expect(recovery).resolves.toEqual({ fileId: identity.fileId, url: '/master.m3u8' });
    } else {
      await expect(recovery).rejects.toBe(error);
    }
  });

  it('does not bypass authorization failure with a delivery probe', async () => {
    complete.mockRejectedValue(new ConnectError('forbidden', Code.PermissionDenied));
    await expect(recoverCompletedUploadAction(identity)).rejects.toThrow('Forbidden');
    expect(delivery).not.toHaveBeenCalled();
  });

  it('keeps generic network unavailability ambiguous for readiness recovery', async () => {
    const error = new ConnectError('connection unavailable', Code.Unavailable);
    complete.mockRejectedValue(error);
    delivery.mockResolvedValue({});
    await expect(recoverCompletedUploadAction(identity)).rejects.toBe(error);
    expect(delivery).toHaveBeenCalledWith({ fileId: identity.fileId });
  });

  it('keeps integrity failed-precondition terminal even if the missing-artifact token is present', async () => {
    complete.mockRejectedValue(
      new ConnectError('CLIENT_MEDIA_ARTIFACTS_MISSING: invalid hash', Code.FailedPrecondition),
    );
    await expect(recoverCompletedClientMediaUploadAction(identity)).resolves.toEqual({
      ok: false,
      error: 'Upload failed',
      errorCode: Code.FailedPrecondition,
    });
    expect(delivery).not.toHaveBeenCalled();
  });

  it.each([completeClientMediaUploadAction, recoverCompletedClientMediaUploadAction])(
    'returns a serializable missing-artifacts failure',
    async (action) => {
      complete.mockRejectedValue(new ConnectError('CLIENT_MEDIA_ARTIFACTS_MISSING: absent object', Code.Unavailable));
      const result = JSON.parse(JSON.stringify(await action(identity)));
      expect(result).toEqual({ ok: false, error: 'CLIENT_MEDIA_ARTIFACTS_MISSING', errorCode: Code.Unavailable });
      expect(delivery).not.toHaveBeenCalled();
    },
  );

  it.each([
    [Code.Unauthenticated, 'Unauthorized'],
    [Code.PermissionDenied, 'Forbidden'],
    [Code.FailedPrecondition, 'Upload failed'],
    [Code.Unavailable, 'Upload finalization failed'],
  ])('returns stable structured classification for completion code %s', async (code, error) => {
    complete.mockRejectedValue(new ConnectError('server failure', code));
    await expect(completeClientMediaUploadAction(identity)).resolves.toMatchObject({
      ok: false,
      error,
      errorCode: code,
    });
  });

  it('returns the registered playback URL and identity after completion ACK', async () => {
    complete.mockResolvedValue({ fileId: identity.fileId, delivery: readyDelivery() });
    await expect(completeClientMediaUploadAction(identity)).resolves.toEqual({
      ok: true,
      url: '/master.m3u8',
      fileId: identity.fileId,
    });
  });
});
