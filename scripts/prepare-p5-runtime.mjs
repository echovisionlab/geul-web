import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const p5PackageDirectory = dirname(dirname(fileURLToPath(import.meta.resolve('p5'))));
const outputDirectory = resolve('public/vendors/p5');

await mkdir(outputDirectory, { recursive: true });
await copyFile(resolve(p5PackageDirectory, 'lib/p5.min.js'), resolve(outputDirectory, 'p5.min.js'));
