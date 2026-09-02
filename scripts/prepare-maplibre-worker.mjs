import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mapLibreDistDirectory = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
const outputDirectory = resolve('public/providers/maplibre');
const assets = [
  ['maplibre-gl-worker.mjs', resolve(mapLibreDistDirectory, 'maplibre-gl-worker.mjs')],
  ['maplibre-gl-shared.mjs', resolve(mapLibreDistDirectory, 'maplibre-gl-shared.mjs')],
  ['LICENSE.txt', resolve(mapLibreDistDirectory, '../LICENSE.txt')],
];

await mkdir(outputDirectory, { recursive: true });

await Promise.all(assets.map(([assetName, source]) => copyFile(source, resolve(outputDirectory, assetName))));
