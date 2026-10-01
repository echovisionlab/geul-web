import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { basename, dirname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mapLibreDistDirectory = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
const mapLibreWorkerSource = resolve(mapLibreDistDirectory, 'maplibre-gl-worker.mjs');
const mapLibreSharedSource = resolve(mapLibreDistDirectory, 'maplibre-gl-shared.mjs');
const mapLibreLicenseSource = resolve(mapLibreDistDirectory, '../LICENSE.txt');
const mapLibreWorkerFilename = 'maplibre-gl-worker.mjs';
const mapLibreSharedFilename = 'maplibre-gl-shared.mjs';

/**
 * Build MapLibre's module worker and its static imports into one same-origin ESM asset.
 * The output path seam lets tests inspect generated assets without touching public/.
 *
 * @param {string} outputDirectory
 */
export async function prepareMapLibreWorker(outputDirectory = resolve('public/providers/maplibre')) {
  const workerOutput = resolve(outputDirectory, mapLibreWorkerFilename);
  const sharedOutput = resolve(outputDirectory, mapLibreSharedFilename);

  await mkdir(outputDirectory, { recursive: true });

  const [workerSourceBytes, sharedSourceBytes] = await Promise.all([
    readFile(mapLibreWorkerSource),
    readFile(mapLibreSharedSource),
  ]);
  const buildResult = await build({
    bundle: true,
    entryPoints: [mapLibreWorkerSource],
    format: 'esm',
    legalComments: 'inline',
    logLevel: 'silent',
    metafile: true,
    minify: true,
    outfile: workerOutput,
    platform: 'browser',
    treeShaking: true,
  });

  const unexpectedWarnings = buildResult.warnings.filter(
    ({ text }) => !text.includes('will not be bundled because the argument is not a string literal'),
  );
  if (unexpectedWarnings.length > 0) {
    throw new Error(unexpectedWarnings.map(({ text }) => text).join('\n'));
  }

  await Promise.all([
    copyFile(mapLibreLicenseSource, resolve(outputDirectory, 'LICENSE.txt')),
    rm(sharedOutput, { force: true }),
  ]);

  const bundleBytes = await readFile(workerOutput);
  const outputMetadata = Object.values(buildResult.metafile.outputs)[0];
  const bundledInputs = Object.entries(buildResult.metafile.inputs).map(([path, input]) => ({
    path: relative(mapLibreDistDirectory, resolve(path)),
    bytes: input.bytes,
    bytesInOutput: outputMetadata.inputs[path]?.bytesInOutput ?? 0,
  }));
  const gzipBytes = (bytes) => gzipSync(bytes, { level: 9 }).byteLength;

  return {
    originalBytes: workerSourceBytes.byteLength + sharedSourceBytes.byteLength,
    originalGzipBytes: gzipBytes(workerSourceBytes) + gzipBytes(sharedSourceBytes),
    bundleBytes: bundleBytes.byteLength,
    bundleGzipBytes: gzipBytes(bundleBytes),
    bundledInputs,
    outputImports: outputMetadata.imports.map(({ path }) => path),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const report = await prepareMapLibreWorker();
  console.log(
    `MapLibre worker ESM: ${report.originalBytes} bytes (${report.originalGzipBytes} gzip) across 2 source assets -> ${report.bundleBytes} bytes (${report.bundleGzipBytes} gzip) in 1 asset`,
  );
  console.log(
    `Bundled input graph: ${report.bundledInputs
      .map(({ path, bytes, bytesInOutput }) => `${basename(path)} ${bytes}B -> ${bytesInOutput}B`)
      .join(', ')}`,
  );
}
