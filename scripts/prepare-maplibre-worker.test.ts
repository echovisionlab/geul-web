import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prepareMapLibreWorker } from './prepare-maplibre-worker.mjs';

describe('prepareMapLibreWorker', () => {
  it('publishes the self-contained upstream ESM worker unchanged, preserves runtime plugin imports and ships the license', async () => {
    const outputDirectory = await mkdtemp(resolve(tmpdir(), 'maplibre-worker-test-'));
    const mapLibreDistDirectory = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));

    try {
      const staleSharedModule = resolve(outputDirectory, 'maplibre-gl-shared.mjs');
      await writeFile(staleSharedModule, 'stale generated artifact');

      const report = await prepareMapLibreWorker(outputDirectory);
      const [worker, upstreamWorker, license] = await Promise.all([
        readFile(resolve(outputDirectory, 'maplibre-gl-worker.mjs')),
        readFile(resolve(mapLibreDistDirectory, 'maplibre-gl-worker.mjs')),
        readFile(resolve(outputDirectory, 'LICENSE.txt')),
      ]);
      const source = worker.toString('utf8');

      expect((await readdir(outputDirectory)).sort()).toEqual(['LICENSE.txt', 'maplibre-gl-worker.mjs']);
      expect(worker.equals(upstreamWorker)).toBe(true);
      expect(source).not.toContain('maplibre-gl-shared.mjs');
      expect([...source.matchAll(/\bimport\s*\(/g)]).toHaveLength(2);
      expect(source).toContain('registerRTLTextPlugin');
      expect(source).toContain('addProtocol');
      expect(report).toEqual({
        bytes: worker.byteLength,
        gzipBytes: gzipSync(worker, { level: 9 }).byteLength,
      });
      expect(license).toEqual(await readFile(resolve(mapLibreDistDirectory, '../LICENSE.txt')));
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
