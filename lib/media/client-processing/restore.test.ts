import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fingerprintSource, type StoredManifest } from './artifact-storage';
import { ClientMediaRestoreMismatchError, restoreMedia } from './processor';
const storageId = 'geul-client-media-00000000-0000-0000-0000-000000000000';
const source = new File(['source bytes'], 'original.wav', { type: 'audio/wav', lastModified: 123 });
const signal = () => new AbortController().signal;
let files: Map<string, File>;
let manifest: StoredManifest;
let removeEntry: ReturnType<typeof vi.fn>;
beforeEach(async () => {
  vi.stubGlobal('crypto', webcrypto);
  files = new Map();
  removeEntry = vi.fn(async () => {});
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: async () => ({
        removeEntry,
        getDirectoryHandle: async () => ({
          getFileHandle: async (name: string) => {
            if (!files.has(name)) {
              throw new DOMException('missing', 'NotFoundError');
            }
            return { getFile: async () => files.get(name)! };
          },
        }),
      }),
    },
  });
  manifest = {
    version: 1,
    storageId,
    metadata: { kind: 'audio', durationSeconds: 1 },
    source: {
      name: source.name,
      size: source.size,
      type: source.type,
      lastModified: source.lastModified,
      fingerprint: await fingerprintSource(source, signal()),
    },
    artifacts: [],
  };
  for (const path of ['master.m3u8', 'waveform.json', 'spectrogram.png']) {
    const file = new File([path], path);
    files.set(path, file);
    const digest = await webcrypto.subtle.digest('SHA-256', await file.arrayBuffer());
    manifest.artifacts.push({
      path,
      size: file.size,
      mimeType: 'application/test',
      sha256: Buffer.from(digest).toString('hex'),
    });
  }
  files.set('manifest.json', new File([JSON.stringify(manifest)], 'manifest.json'));
});
afterEach(() => vi.unstubAllGlobals());
it('recovers typed files after reload and deletes only on explicit disposal', async () => {
  const onProgress = vi.fn();
  const restored = await restoreMedia(storageId, source, { signal: signal(), onProgress });
  expect(restored?.sourceFingerprint).toBe(manifest.source.fingerprint);
  expect(restored?.artifacts.every((a) => a.file.type === 'application/test')).toBe(true);
  expect(onProgress.mock.calls.at(-1)).toEqual([1]);
  expect(removeEntry).not.toHaveBeenCalled();
  await restored!.dispose();
  expect(removeEntry).toHaveBeenCalledWith(storageId, { recursive: true });
});
it('returns null for an absent manifest', async () => {
  files.delete('manifest.json');
  expect(await restoreMedia(storageId, source, { signal: signal() })).toBeNull();
  expect(removeEntry).not.toHaveBeenCalled();
});
it('rejects changed source identity and equal-sized changed bytes without deleting the bundle', async () => {
  for (const file of [
    new File(['source bytes'], 'renamed.wav', { type: source.type, lastModified: 123 }),
    new File(['SOURCE bytes'], source.name, { type: source.type, lastModified: 123 }),
  ]) {
    await expect(restoreMedia(storageId, file, { signal: signal() })).rejects.toBeInstanceOf(
      ClientMediaRestoreMismatchError,
    );
  }
  expect(removeEntry).not.toHaveBeenCalled();
});
it('rejects altered or missing artifacts and unsafe manifest paths', async () => {
  files.set('master.m3u8', new File(['MASTER.M3U8'], 'master.m3u8'));
  await expect(restoreMedia(storageId, source, { signal: signal() })).rejects.toBeInstanceOf(
    ClientMediaRestoreMismatchError,
  );
  files.delete('master.m3u8');
  await expect(restoreMedia(storageId, source, { signal: signal() })).rejects.toBeInstanceOf(
    ClientMediaRestoreMismatchError,
  );
  manifest.artifacts[0].path = '../escape';
  files.set('manifest.json', new File([JSON.stringify(manifest)], 'manifest.json'));
  await expect(restoreMedia(storageId, source, { signal: signal() })).rejects.toBeInstanceOf(
    ClientMediaRestoreMismatchError,
  );
  expect(removeEntry).not.toHaveBeenCalled();
});
it('preserves bundle on abort and transient OPFS error', async () => {
  const controller = new AbortController();
  await expect(
    restoreMedia(storageId, source, { signal: controller.signal, onProgress: () => controller.abort() }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  vi.stubGlobal('navigator', {
    storage: {
      getDirectory: async () => {
        throw new DOMException('locked', 'InvalidStateError');
      },
    },
  });
  await expect(restoreMedia(storageId, source, { signal: signal() })).rejects.toMatchObject({
    name: 'InvalidStateError',
  });
  expect(removeEntry).not.toHaveBeenCalled();
});
it('fingerprints the final partial chunk without reading the whole source into memory', async () => {
  const bytes = new Uint8Array(8 * 1024 * 1024 + 17);
  const file = new File([bytes], 'large.wav');
  const wholeSourceRead = vi.spyOn(file, 'arrayBuffer').mockRejectedValue(new Error('Whole source read'));
  const slice = vi.spyOn(file, 'slice');
  const fingerprint = await fingerprintSource(file, signal());
  expect(wholeSourceRead).not.toHaveBeenCalled();
  expect(slice.mock.calls.map(([start, end]) => end! - start!)).toEqual([8 * 1024 * 1024, 17]);
  bytes[bytes.length - 1] = 1;
  expect(await fingerprintSource(new File([bytes], 'large.wav'), signal())).not.toBe(fingerprint);
});

it('preserves the exact v1 NUL-separated header and chain digest with numeric size and chunk constants', async () => {
  expect(await fingerprintSource(source, signal())).toBe(
    'client-media-source-v1:8a5ad99fd50583cfde4f772db60dafb03bd0599848bb6a2008ef484b573736ae',
  );
});
