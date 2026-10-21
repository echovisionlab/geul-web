import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mapLibreDistDirectory = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
const mapLibreWorkerSource = resolve(mapLibreDistDirectory, 'maplibre-gl-worker.mjs');
const mapLibreLicenseSource = resolve(mapLibreDistDirectory, '../LICENSE.txt');
const mapLibreWorkerFilename = 'maplibre-gl-worker.mjs';
const mapLibreSharedFilename = 'maplibre-gl-shared.mjs';

/**
 * Publish MapLibre's module worker as one same-origin ESM asset. MapLibre ships the worker
 * self-contained, so it is copied unchanged; re-minifying it only grows the gzip size. The
 * build fails if the worker gains static imports, because the asset would then need its
 * siblings. The output path seam lets tests inspect generated assets without touching public/.
 *
 * @param {string} outputDirectory
 */
export async function prepareMapLibreWorker(outputDirectory = resolve('public/providers/maplibre')) {
  const workerOutput = resolve(outputDirectory, mapLibreWorkerFilename);

  // Resolve the static import graph only; nothing is written.
  const { metafile, warnings } = await build({
    bundle: true,
    entryPoints: [mapLibreWorkerSource],
    format: 'esm',
    logLevel: 'silent',
    metafile: true,
    outfile: workerOutput,
    platform: 'browser',
    write: false,
  });
  const unexpectedWarnings = warnings.filter(
    ({ text }) => !text.includes('will not be bundled because the argument is not a string literal'),
  );
  if (unexpectedWarnings.length > 0) {
    throw new Error(unexpectedWarnings.map(({ text }) => text).join('\n'));
  }
  const inputs = Object.keys(metafile.inputs).map((path) => relative(mapLibreDistDirectory, resolve(path)));
  if (inputs.length !== 1) {
    throw new Error(`MapLibre worker is no longer self-contained: ${inputs.join(', ')}`);
  }

  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    copyFile(mapLibreWorkerSource, workerOutput),
    copyFile(mapLibreLicenseSource, resolve(outputDirectory, 'LICENSE.txt')),
    rm(resolve(outputDirectory, mapLibreSharedFilename), { force: true }),
  ]);

  const worker = await readFile(workerOutput);
  return { bytes: worker.byteLength, gzipBytes: gzipSync(worker, { level: 9 }).byteLength };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await prepareMapLibreWorker();
  console.log(`MapLibre worker ESM: ${report.bytes} bytes (${report.gzipBytes} gzip) in 1 asset`);
}
