import { createHash, randomUUID } from 'node:crypto';
import { copyFile, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CLIENT_MEDIA_WEBP_VERSION = '1.5.0';
export const CLIENT_MEDIA_WEBP_ASSET_BASE = '/client-media/codecs/webp-1.5.0/';
export const CLIENT_MEDIA_WEBP_ASSETS = [
  {
    filename: 'webp_enc.wasm',
    bytes: 281261,
    sha256: 'b6085bb6702f144e9dc6016d58d230b34a84976bf0d080b7390b4b4b137d6ab7',
  },
  {
    filename: 'webp_enc_simd.wasm',
    bytes: 345584,
    sha256: '39c279269ec1163b987b6d69749458e3d5b03b9585f58b6ca5455b76b504a305',
  },
];

/** Copy only the exact pinned official encoder artifacts; never rebuild or patch WASM. */
export async function prepareClientMediaCodecs(
  outputDirectory = fileURLToPath(new URL(`../public${CLIENT_MEDIA_WEBP_ASSET_BASE}`, import.meta.url)),
  packageDirectory = dirname(fileURLToPath(import.meta.resolve('@jsquash/webp'))),
) {
  const metadata = JSON.parse(await readFile(resolve(packageDirectory, 'package.json'), 'utf8'));
  if (metadata.name !== '@jsquash/webp' || metadata.version !== CLIENT_MEDIA_WEBP_VERSION) {
    throw new Error(`Client media WebP assets require @jsquash/webp ${CLIENT_MEDIA_WEBP_VERSION}.`);
  }
  const sources = await Promise.all(
    CLIENT_MEDIA_WEBP_ASSETS.map(async (asset) => {
      const source = resolve(packageDirectory, 'codec/enc', asset.filename);
      const bytes = await readFile(source);
      if (bytes.byteLength !== asset.bytes || createHash('sha256').update(bytes).digest('hex') !== asset.sha256) {
        throw new Error(`Pinned client media WebP asset integrity mismatch: ${asset.filename}`);
      }
      return { asset, source };
    }),
  );
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all(
    sources.map(async ({ asset, source }) => {
      const destination = resolve(outputDirectory, asset.filename);
      const temporary = `${destination}.${randomUUID()}.tmp`;
      try {
        await copyFile(source, temporary);
        const copied = await readFile(temporary);
        if (createHash('sha256').update(copied).digest('hex') !== asset.sha256) {
          throw new Error(`Copied client media WebP asset integrity mismatch: ${asset.filename}`);
        }
        // Concurrent Next config evaluations must observe complete WASM files.
        await rename(temporary, destination);
      } finally {
        await rm(temporary, { force: true });
      }
    }),
  );
  await copyFile(resolve(packageDirectory, 'LICENSE'), resolve(outputDirectory, 'LICENSE'));
  return {
    version: CLIENT_MEDIA_WEBP_VERSION,
    baseUrl: CLIENT_MEDIA_WEBP_ASSET_BASE,
    assets: CLIENT_MEDIA_WEBP_ASSETS,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log(JSON.stringify(await prepareClientMediaCodecs()));
}
