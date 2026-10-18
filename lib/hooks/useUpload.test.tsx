// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  multipartUpload: vi.fn(),
}));

vi.mock('./useFileUpload', () => ({
  useFileUpload: () => ({
    upload: mocks.multipartUpload,
    abort: vi.fn(),
    downloadFromUrl: vi.fn(),
    isUploading: false,
    isDownloading: false,
  }),
}));

import { useUpload } from './useUpload';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type HookResult = ReturnType<typeof useUpload>;
let current: HookResult | null = null;
let activeUploadType = UploadType.PROGRAM_EVENT_POSTER;
let container: HTMLDivElement;
let root: Root;

function Harness() {
  current = useUpload(activeUploadType);
  return null;
}

beforeEach(() => {
  mocks.multipartUpload.mockReset();
  mocks.multipartUpload.mockResolvedValue({ fileId: 'file-1', url: 'https://cdn.example.test/poster.webp' });
  activeUploadType = UploadType.PROGRAM_EVENT_POSTER;
  current = null;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<Harness />));
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useUpload Blob filename contract', () => {
  it('adds the MIME extension to an extensionless generated image name', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster-123',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster-123.webp');
    expect(uploadedFile.type).toBe('image/webp');
  });

  it('replaces a stale extension with the extension required by the Blob MIME', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster.jpg',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster.webp');
  });

  it('keeps an already canonical filename unchanged', async () => {
    await act(async () => {
      await current?.upload(new Blob(['poster'], { type: 'image/webp' }), {
        entityId: 'event-1',
        fileName: 'poster.WEBP',
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('poster.WEBP');
  });

  it('preserves Blob bytes and upload context while canonicalizing MIME and filename aliases', async () => {
    activeUploadType = UploadType.TRACK_AUDIO;
    act(() => root.render(<Harness />));
    const payload = 'raw-aiff-payload';
    const blob = new Blob([payload], { type: 'audio/x-aiff' });

    await act(async () => {
      await current?.upload(blob, {
        entityId: 'release-1',
        slotId: 'master-audio',
        fileName: 'track.aif',
        concurrency: 3,
      });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile.name).toBe('track.aiff');
    expect(uploadedFile.type).toBe('audio/aiff');
    expect(await uploadedFile.text()).toBe(payload);
    expect(mocks.multipartUpload.mock.calls[0]?.[1]).toMatchObject({
      uploadType: UploadType.TRACK_AUDIO,
      entityId: 'release-1',
      slotId: 'master-audio',
      concurrency: 3,
    });
  });

  it('normalizes direct File uploads without replacing their bytes or last-modified time', async () => {
    activeUploadType = UploadType.TRACK_AUDIO;
    act(() => root.render(<Harness />));
    const payload = 'raw-aiff-payload';
    const source = new File([payload], 'track.aif', { type: 'audio/x-aiff', lastModified: 9876 });

    await act(async () => {
      await current?.uploadFile(source, { entityId: 'release-1', slotId: 'master-audio' });
    });

    const uploadedFile = mocks.multipartUpload.mock.calls[0]?.[0] as File;
    expect(uploadedFile).not.toBe(source);
    expect(uploadedFile.name).toBe('track.aiff');
    expect(uploadedFile.type).toBe('audio/aiff');
    expect(uploadedFile.lastModified).toBe(9876);
    expect(await uploadedFile.text()).toBe(payload);
    expect(mocks.multipartUpload.mock.calls[0]?.[1]).toMatchObject({
      uploadType: UploadType.TRACK_AUDIO,
      entityId: 'release-1',
      slotId: 'master-audio',
    });
  });
});
