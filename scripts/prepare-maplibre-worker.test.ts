import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { prepareMapLibreWorker } from './prepare-maplibre-worker.mjs';

describe('prepareMapLibreWorker', () => {
  it('emits one self-contained ESM worker, preserves runtime plugin imports and ships the license', async () => {
    const outputDirectory = await mkdtemp(resolve(tmpdir(), 'maplibre-worker-test-'));
    const mapLibreDistDirectory = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));

    try {
      const staleSharedModule = resolve(outputDirectory, 'maplibre-gl-shared.mjs');
      await writeFile(staleSharedModule, 'stale generated artifact');

      const report = await prepareMapLibreWorker(outputDirectory);
      const [worker, license] = await Promise.all([
        readFile(resolve(outputDirectory, 'maplibre-gl-worker.mjs'), 'utf8'),
        readFile(resolve(outputDirectory, 'LICENSE.txt')),
      ]);

      expect((await readdir(outputDirectory)).sort()).toEqual(['LICENSE.txt', 'maplibre-gl-worker.mjs']);
      expect(report.outputImports).toEqual([]);
      expect(worker).not.toContain('maplibre-gl-shared.mjs');
      expect([...worker.matchAll(/\bimport\s*\(/g)]).toHaveLength(2);
      expect(worker).toContain('registerRTLTextPlugin');
      expect(worker).toContain('addProtocol');

      expect(report.bundledInputs.map(({ path }) => path)).toEqual(
        expect.arrayContaining(['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']),
      );
      const sourceFiles = await Promise.all(
        ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'].map((filename) =>
          readFile(resolve(mapLibreDistDirectory, filename)),
        ),
      );
      expect(report.originalBytes).toBe(sourceFiles.reduce((total, source) => total + source.byteLength, 0));
      expect(report.originalGzipBytes).toBe(
        sourceFiles.reduce((total, source) => total + gzipSync(source, { level: 9 }).byteLength, 0),
      );
      expect(report.bundleBytes).toBeLessThan(report.originalBytes);
      expect(report.bundleGzipBytes).toBe(gzipSync(Buffer.from(worker), { level: 9 }).byteLength);
      expect(report.bundleGzipBytes).toBeLessThan(report.originalGzipBytes);
      expect(license).toEqual(await readFile(resolve(mapLibreDistDirectory, '../LICENSE.txt')));
    } finally {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  });
});
