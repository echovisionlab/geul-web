import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, expect, it, vi } from 'vitest';
import { CLIENT_MEDIA_WEBP_ASSETS, prepareClientMediaCodecs } from './prepare-client-media-codecs.mjs';

const io = vi.hoisted(() => ({
  files: new Map<string, Buffer>(),
  version: undefined as string | undefined,
  corrupt: false,
}));

// Read the installed official package; isolate only publication and failure inputs.
vi.mock('node:fs/promises', async () => {
  const fs = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  const sourceBytes = async (path: string) => {
    const bytes = await fs.readFile(path);
    if (io.corrupt && path.endsWith('/codec/enc/webp_enc.wasm')) {
      const modified = Buffer.from(bytes);
      modified[0] = (modified[0] ?? 0) ^ 1;
      return modified;
    }
    return bytes;
  };
  return {
    ...fs,
    mkdir: vi.fn(async () => undefined),
    readFile: vi.fn(async (path: string, encoding?: string) => {
      const bytes = io.files.get(path) ?? (await sourceBytes(path));
      if (encoding === 'utf8') {
        if (io.version && path.endsWith('/package.json')) {
          return JSON.stringify({ ...JSON.parse(bytes.toString('utf8')), version: io.version });
        }
        return bytes.toString('utf8');
      }
      return bytes;
    }),
    copyFile: vi.fn(async (source: string, destination: string) => {
      io.files.set(destination, await sourceBytes(source));
    }),
    rename: vi.fn(async (source: string, destination: string) => {
      const bytes = io.files.get(source);
      if (!bytes) {
        throw new Error(`Missing copied asset: ${source}`);
      }
      io.files.set(destination, bytes);
      io.files.delete(source);
    }),
    rm: vi.fn(async (path: string) => {
      io.files.delete(path);
    }),
  };
});

const output = '/client-media-codecs-unit-output';
const packageRoot = dirname(fileURLToPath(import.meta.resolve('@jsquash/webp')));
beforeEach(() => {
  io.files.clear();
  io.version = undefined;
  io.corrupt = false;
});

it('publishes exact pinned official WASM bytes and the package license', async () => {
  const result = await prepareClientMediaCodecs(output);
  expect(result.version).toBe('1.5.0');
  expect(result.baseUrl).toBe('/client-media/codecs/webp-1.5.0/');
  expect([...io.files.keys()].sort()).toEqual([
    resolve(output, 'LICENSE'),
    resolve(output, 'webp_enc.wasm'),
    resolve(output, 'webp_enc_simd.wasm'),
  ]);
  for (const asset of CLIENT_MEDIA_WEBP_ASSETS) {
    const bytes = await readFile(resolve(output, asset.filename));
    expect(bytes.byteLength).toBe(asset.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256);
  }
  expect(io.files.get(resolve(output, 'LICENSE'))).toEqual(await readFile(resolve(packageRoot, 'LICENSE')));
});

it('rejects an unpinned package version before publishing assets', async () => {
  io.version = '1.5.1';
  await expect(prepareClientMediaCodecs(output)).rejects.toThrow('require @jsquash/webp 1.5.0');
  expect(io.files.size).toBe(0);
});

it('rejects changed official WASM bytes even when the byte length is unchanged', async () => {
  io.corrupt = true;
  await expect(prepareClientMediaCodecs(output)).rejects.toThrow('integrity mismatch');
  expect(io.files.size).toBe(0);
});
