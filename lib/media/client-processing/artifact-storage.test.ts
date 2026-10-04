import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { ClientMediaUnavailableError } from './contracts';
import { MAX_ARTIFACT_BYTES, createArtifactStore, disposeNamespace, saveManifest } from './artifact-storage';

const namespace = 'geul-client-media-12345678-1234-1234-1234-123456789abc';
function storageFixture() {
  let data = new Blob();
  let committed = false;
  const writable = {
    write: vi.fn(async (blob: Blob) => {
      data = blob;
    }),
    close: vi.fn(async () => {
      committed = true;
    }),
    abort: vi.fn(async () => {}),
  };
  const handle = {
    createWritable: vi.fn(async () => writable),
    getFile: vi.fn(async () => {
      if (!committed) {
        throw new Error('Read before destination close.');
      }
      return new File([data], 'segment.ts');
    }),
  };
  const directory = { getFileHandle: vi.fn(async () => handle) };
  const root = {
    getDirectoryHandle: vi.fn(async () => directory),
    removeEntry: vi.fn(async () => {}),
  };
  vi.stubGlobal('navigator', { storage: { getDirectory: vi.fn(async () => root) } });
  vi.stubGlobal('crypto', webcrypto);
  return { root, directory, writable, handle };
}

afterEach(() => vi.unstubAllGlobals());

describe('client media OPFS artifacts', () => {
  it('persists and closes each artifact before hashing the stored File', async () => {
    const fixture = storageFixture();
    const storage = await createArtifactStore(namespace, new AbortController().signal);
    await storage.write({ path: 'segment-0001.ts', mimeType: 'video/mp2t', blob: new Blob(['artifact']) });
    expect(storage.artifacts()[0]).toMatchObject({
      path: 'segment-0001.ts',
      size: 8,
      sha256: createHash('sha256').update('artifact').digest('hex'),
    });
    expect(fixture.writable.close).toHaveBeenCalledOnce();
    expect(await storage.artifacts()[0].file.text()).toBe('artifact');
    await storage.dispose();
    await storage.dispose();
    expect(fixture.root.removeEntry).toHaveBeenCalledExactlyOnceWith(namespace, { recursive: true });
  });

  it('rejects duplicate or escaping output names', async () => {
    storageFixture();
    const storage = await createArtifactStore(namespace, new AbortController().signal);
    const artifact = { path: 'master.m3u8', mimeType: 'application/vnd.apple.mpegurl', blob: new Blob(['playlist']) };
    await storage.write(artifact);
    await expect(storage.write(artifact)).rejects.toThrow('Duplicate');
    await expect(storage.write({ ...artifact, path: '../other' })).rejects.toThrow(
      'Invalid client media artifact path',
    );
    await storage.dispose();
  });

  it('refuses oversized artifacts before any writable stream or hash buffer opens', async () => {
    const fixture = storageFixture();
    const storage = await createArtifactStore(namespace, new AbortController().signal);
    await expect(
      storage.write({
        path: 'segment.ts',
        mimeType: 'video/mp2t',
        blob: { size: MAX_ARTIFACT_BYTES + 1 } as Blob,
      }),
    ).rejects.toBeInstanceOf(ClientMediaUnavailableError);
    expect(fixture.directory.getFileHandle).not.toHaveBeenCalled();
    await storage.dispose();
  });

  it('aborts a pending write and preserves AbortError when canceled', async () => {
    const fixture = storageFixture();
    const controller = new AbortController();
    fixture.writable.write.mockImplementation(async () => {
      controller.abort();
    });
    const storage = await createArtifactStore(namespace, controller.signal);
    await expect(
      storage.write({ path: 'segment.ts', mimeType: 'video/mp2t', blob: new Blob(['test']) }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fixture.writable.abort).toHaveBeenCalledOnce();
    expect(fixture.writable.close).not.toHaveBeenCalled();
    await storage.dispose();
  });

  it('reserves and closes the completion manifest before making it available', async () => {
    const fixture = storageFixture();
    const signal = new AbortController().signal;
    const storage = await createArtifactStore(namespace, signal);
    await expect(
      storage.write({ path: 'manifest.json', mimeType: 'application/json', blob: new Blob(['bad']) }),
    ).rejects.toThrow('reserved');
    await saveManifest(
      namespace,
      {
        version: 1,
        storageId: namespace,
        metadata: { kind: 'audio', durationSeconds: 1 },
        source: {
          name: 'original.wav',
          size: 1,
          type: 'audio/wav',
          lastModified: 0,
          fingerprint: `client-media-source-v1:${'a'.repeat(64)}`,
        },
        artifacts: [],
      },
      signal,
    );
    expect(fixture.directory.getFileHandle).toHaveBeenCalledWith('manifest.json', { create: true });
    expect(fixture.writable.close).toHaveBeenCalledOnce();
    expect(JSON.parse(await (await fixture.handle.getFile()).text()).storageId).toBe(namespace);
    expect(fixture.root.removeEntry).not.toHaveBeenCalled();
  });

  it('never cleans unrelated directories', async () => {
    const fixture = storageFixture();
    await expect(disposeNamespace('user-documents')).rejects.toThrow('namespace');
    expect(fixture.root.removeEntry).not.toHaveBeenCalled();
  });
});
