import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { createRemoteSourceUrl, downloadRemoteSource } from './remote-source';

const options = {
  uploadType: UploadType.EDITOR_AUDIO,
  entityId: 'entity',
  entityType: TranscodeEntityType.PAGE,
  slotId: 'slot',
  expectedCurrentFileId: 'old',
};
let bytes: Uint8Array[];
let write: ReturnType<typeof vi.fn>;
let abort: ReturnType<typeof vi.fn>;
let close: ReturnType<typeof vi.fn>;
let removeEntry: ReturnType<typeof vi.fn>;
const response = (body: ReadableStream<Uint8Array>, size?: number) =>
  new Response(body, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Disposition': "attachment; filename*=UTF-8''%EC%86%8C%EB%A6%AC.wav",
      ...(size === undefined ? {} : { 'X-Upload-Source-Size': String(size) }),
    },
  });
const stream = (...chunks: Uint8Array[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });

beforeEach(() => {
  bytes = [];
  write = vi.fn(async (chunk: Uint8Array) => {
    bytes.push(chunk);
  });
  abort = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  removeEntry = vi.fn<(name: string, options?: FileSystemRemoveOptions) => Promise<void>>(async () => undefined);
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: vi.fn(async () => ({
        removeEntry,
        getDirectoryHandle: vi.fn(async () => ({
          getFileHandle: vi.fn(async () => ({
            createWritable: vi.fn(async () => ({ write, abort, close })),
            getFile: vi.fn(
              async () =>
                new File(
                  bytes.map((chunk) => new Uint8Array(chunk)),
                  'source',
                ),
            ),
          })),
        })),
      })),
    },
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('remote source download', () => {
  it('omits editor and general targets and retains durable targets', () => {
    for (const uploadType of [
      UploadType.EDITOR_AUDIO,
      UploadType.EDITOR_IMAGE,
      UploadType.EDITOR_VIDEO,
      UploadType.EDITOR_ATTACHMENT,
      UploadType.EDITOR_MESH,
      UploadType.GENERAL_FILE,
    ]) {
      const query = new URL(
        createRemoteSourceUrl('https://source.example/audio', { ...options, uploadType }),
        'https://local.example',
      ).searchParams;
      expect([...query.keys()]).toEqual(['uploadType', 'url']);
    }
    const query = new URL(
      createRemoteSourceUrl('https://source.example/audio', { ...options, uploadType: UploadType.TRACK_AUDIO }),
      'https://local.example',
    ).searchParams;
    expect(query.get('entityId')).toBe('entity');
    expect(query.get('slotId')).toBe('slot');
    expect(query.get('expectedCurrentFileId')).toBe('old');
    expect(query.get('entityType')).toBe(String(TranscodeEntityType.PAGE));
    expect(() => createRemoteSourceUrl('http://source.example', options)).toThrow('HTTPS');
  });

  it.each([
    { disposition: 'attachment; filename=original.wav', name: 'original.wav' },
    { disposition: 'attachment; filename="original audio.wav"', name: 'original audio.wav' },
    { disposition: 'attachment; filename="original \\"audio\\".wav"', name: 'original "audio".wav' },
    { disposition: "attachment; filename*=utf-8''%EC%86%8C%EB%A6%AC.wav", name: '소리.wav' },
  ])('accepts Go mime.FormatMediaType output $disposition', async ({ disposition, name }) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(stream(new Uint8Array([1, 2])), {
            headers: { 'Content-Type': 'audio/wav', 'Content-Disposition': disposition, 'X-Upload-Source-Size': '2' },
          }),
      ),
    );
    const downloaded = await downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      vi.fn(),
    );
    expect(downloaded.file.name).toBe(name);
    expect(downloaded.file.type).toBe('audio/wav');
    await downloaded.dispose();
  });

  it('streams with storage backpressure and preserves canonical metadata without Response buffering', async () => {
    let release: () => void = () => undefined;
    const pendingWrite = new Promise<void>((resolve) => {
      release = resolve;
    });
    write.mockImplementationOnce(async (chunk: Uint8Array) => {
      await pendingWrite;
      bytes.push(chunk);
    });
    const network = response(stream(new Uint8Array([1, 2]), new Uint8Array([3, 4])), 4);
    const read = vi.spyOn(network.body!, 'getReader');
    const blob = vi.spyOn(network, 'blob');
    const arrayBuffer = vi.spyOn(network, 'arrayBuffer');
    const fetchMock = vi.fn<typeof fetch>(async () => network);
    vi.stubGlobal('fetch', fetchMock);
    const progress = vi.fn();
    const download = downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      progress,
    );
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    const readerRead = vi.spyOn(read.mock.results[0]!.value, 'read');
    await Promise.resolve();
    expect(readerRead).not.toHaveBeenCalled();
    release();
    const result = await download;
    expect(result.file.name).toBe('소리.wav');
    expect(result.file.type).toBe('audio/wav');
    expect(result.file.size).toBe(4);
    expect(result.file.lastModified).toBe(0);
    expect(await result.file.bytes()).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(blob).not.toHaveBeenCalled();
    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledTimes(2);
    expect(close).toHaveBeenCalledOnce();
    expect(removeEntry).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ credentials: 'same-origin' });
    await result.dispose();
    await result.dispose();
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenLastCalledWith(4, 4);
  });

  it.each([1, 3])('rejects size mismatch %s and aborts storage before cleaning its namespace', async (size) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(stream(new Uint8Array([1, 2])), size)),
    );
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toThrow();
    expect(abort).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    expect(removeEntry).toHaveBeenCalledOnce();
  });

  it('cancels a pending network read on abort and removes partial storage', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(new ReadableStream<Uint8Array>({ cancel }), 2)),
    );
    const controller = new AbortController();
    const downloading = downloadRemoteSource('https://source.example/audio', options, controller.signal, vi.fn());
    await vi.waitFor(() => expect(write).not.toHaveBeenCalled());
    // Wait for fetch to acquire the reader rather than aborting before storage is opened.
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalled());
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(downloading).rejects.toMatchObject({ name: 'AbortError' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
  });

  it('cleans network and storage after write failure', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1]));
            },
            cancel,
          }),
        ),
      ),
    );
    write.mockRejectedValueOnce(new DOMException('quota', 'QuotaExceededError'));
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toMatchObject({ code: 'CLIENT_MEDIA_UNAVAILABLE', reason: 'storage' });
    expect(abort).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
  });

  it('accepts an unknown-size stream and rejects invalid metadata before writing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(stream(new Uint8Array([1, 2])))),
    );
    const downloaded = await downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      vi.fn(),
    );
    expect(downloaded.file.size).toBe(2);
    await downloaded.dispose();
    write.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(stream(new Uint8Array([1])), {
            headers: { 'Content-Type': 'audio/wav', 'Content-Disposition': 'attachment; filename="../source.wav"' },
          }),
      ),
    );
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toThrow('metadata');
    expect(write).not.toHaveBeenCalled();
    expect(removeEntry).toHaveBeenCalledTimes(2);
  });

  it('rejects known oversize sources before writing and cancels their response stream', async () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(new ReadableStream<Uint8Array>({ cancel }), 9 * 1024 * 1024 * 1024)),
    );
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toMatchObject({ reason: 'resource' });
    expect(write).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
  });

  it.each([
    {
      name: 'transient HTTP 503',
      failure: () => Promise.resolve(new Response(null, { status: 503, headers: { 'Retry-After': '2' } })),
      delay: 2000,
    },
    { name: 'native fetch failure', failure: () => Promise.reject(new TypeError('Failed to fetch')), delay: 1000 },
  ])('retries $name after cleaning the failed attempt namespace', async ({ failure, delay }) => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(failure)
      .mockResolvedValueOnce(response(stream(new Uint8Array([1, 2])), 2));
    vi.stubGlobal('fetch', fetchMock);
    const downloading = downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      vi.fn(),
    );
    await vi.waitFor(() => expect(removeEntry).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(delay);
    const downloaded = await downloading;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(downloaded.file.size).toBe(2);
    expect(removeEntry.mock.calls[0]?.[0]).not.toBe(downloaded.storageId);
    await downloaded.dispose();
    expect(removeEntry).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403])('does not retry terminal HTTP %s failures', async (status) => {
    const fetchMock = vi.fn(async () => new Response(null, { status }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
  });

  it('cancels a download retry wait without retaining a partial namespace or starting another request', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const downloading = downloadRemoteSource('https://source.example/audio', options, controller.signal, vi.fn());
    const rejection = expect(downloading).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(removeEntry).toHaveBeenCalledOnce());
    controller.abort();
    await rejection;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('allows transfers longer than 120 seconds while network chunks keep arriving', async () => {
    vi.useFakeTimers();
    let chunks = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        async pull(controller) {
          if (chunks === 3) {
            controller.close();
            return;
          }
          await new Promise((resolve) => setTimeout(resolve, 80_000));
          chunks += 1;
          controller.enqueue(new Uint8Array([chunks]));
        },
      },
      { highWaterMark: 0 },
    );
    const fetchMock = vi.fn(async () => response(body, 3));
    const progress = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const downloading = downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      progress,
    );
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith(0, 3));
    for (let chunk = 1; chunk <= 3; chunk += 1) {
      await vi.advanceTimersByTimeAsync(80_000);
      expect(progress).toHaveBeenCalledWith(chunk, 3);
    }
    const downloaded = await downloading;
    expect(downloaded.file.size).toBe(3);
    expect(fetchMock).toHaveBeenCalledOnce();
    await downloaded.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['headers', 'body'])('aborts idle %s waits after 120 seconds and retries a fresh source', async (phase) => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    let firstSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(async (_url, init) => {
        firstSignal = init?.signal ?? undefined;
        if (phase === 'body') {
          return response(new ReadableStream<Uint8Array>({ cancel }), 2);
        }
        return new Promise<Response>((_resolve, reject) =>
          firstSignal!.addEventListener('abort', () => reject(new DOMException('connection aborted', 'AbortError')), {
            once: true,
          }),
        );
      })
      .mockResolvedValueOnce(response(stream(new Uint8Array([1, 2])), 2));
    const progress = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const downloading = downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      progress,
    );
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    if (phase === 'body') {
      await vi.waitFor(() => expect(progress).toHaveBeenCalledWith(0, 2));
    }
    await vi.advanceTimersByTimeAsync(120_000);
    expect(firstSignal?.aborted).toBe(true);
    expect(removeEntry).toHaveBeenCalledOnce();
    if (phase === 'body') {
      expect(cancel).toHaveBeenCalledOnce();
    }
    await vi.advanceTimersByTimeAsync(1000);
    const downloaded = await downloading;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(downloaded.file.size).toBe(2);
    await downloaded.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('excludes slow OPFS backpressure from the network inactivity limit', async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const diskWait = new Promise<void>((resolve) => {
      release = resolve;
    });
    write.mockImplementationOnce(async (chunk: Uint8Array) => {
      await diskWait;
      bytes.push(chunk);
    });
    let connectionSignal: AbortSignal | undefined;
    const fetchMock = vi.fn<typeof fetch>(async (_url, init) => {
      connectionSignal = init?.signal ?? undefined;
      return response(stream(new Uint8Array([1, 2])), 2);
    });
    vi.stubGlobal('fetch', fetchMock);
    const downloading = downloadRemoteSource(
      'https://source.example/audio',
      options,
      new AbortController().signal,
      vi.fn(),
    );
    await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(240_000);
    expect(connectionSignal?.aborted).toBe(false);
    expect(removeEntry).not.toHaveBeenCalled();
    release();
    const downloaded = await downloading;
    expect(fetchMock).toHaveBeenCalledOnce();
    await downloaded.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps user cancellation during a stalled body terminal and clears inactivity timers', async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const fetchMock = vi.fn(async () => response(new ReadableStream<Uint8Array>({ cancel }), 2));
    const progress = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const downloading = downloadRemoteSource('https://source.example/audio', options, controller.signal, progress);
    const rejection = expect(downloading).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(progress).toHaveBeenCalledWith(0, 2));
    controller.abort();
    await rejection;
    await vi.advanceTimersByTimeAsync(240_000);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cancel).toHaveBeenCalledOnce();
    expect(removeEntry).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('fails explicitly before fetching when OPFS is unavailable', async () => {
    vi.stubGlobal('navigator', {});
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      downloadRemoteSource('https://source.example/audio', options, new AbortController().signal, vi.fn()),
    ).rejects.toMatchObject({ code: 'CLIENT_MEDIA_UNAVAILABLE', reason: 'capability' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
