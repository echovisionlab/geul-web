import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prepareHwpRuntime } from './prepare-hwp-runtime.mjs';

const run = promisify(execFile);
const basePath = '/vendors/rhwp/0.8.6-dsub.2/';
let projectDirectory: string;
let outputDirectory: string;

beforeEach(async () => {
  await mkdir('.artifacts', { recursive: true });
  projectDirectory = await mkdtemp(resolve('.artifacts', 'hwp-runtime-test-'));
  outputDirectory = resolve(projectDirectory, `public${basePath}`);
});
afterEach(async () => {
  await rm(projectDirectory, { recursive: true, force: true });
});

async function fixture(complete = true, buildId = '0.8.6-dsub.2', manifestBasePath = basePath) {
  const source = resolve(projectDirectory, 'fixture');
  await mkdir(resolve(source, 'assets'), { recursive: true });
  await mkdir(resolve(source, 'fonts'));
  await writeFile(resolve(source, 'index.html'), '<html>HWP editor</html>');
  await writeFile(resolve(source, 'assets/runtime.js'), 'export {};');
  await writeFile(resolve(source, 'fonts/font.woff2'), 'fixture-font');
  await writeFile(resolve(source, 'LICENSE'), 'Apache-2.0');
  await writeFile(resolve(source, 'THIRD_PARTY_LICENSES.md'), 'Third-party notices');
  await writeFile(resolve(source, 'CanvasKit-LICENSE'), 'CanvasKit notices');
  if (complete) {
    await writeFile(resolve(source, 'runtime-manifest.json'), JSON.stringify({ buildId, basePath: manifestBasePath }));
  }
  const archive = resolve(projectDirectory, 'fixture.tar.gz');
  await run('tar', ['-czf', archive, '-C', source, '.']);
  const bytes = await readFile(archive);
  const descriptor = {
    buildId: '0.8.6-dsub.2',
    basePath,
    archiveUrl: 'https://example.test/runtime.tar.gz',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  const fetchArchive = vi.fn(async () => new Response(bytes));
  return { descriptor, fetchArchive };
}

async function expectCleanTemporaryDirectory() {
  expect(await readdir(resolve(projectDirectory, '.artifacts'))).toEqual([]);
}

describe('prepareHwpRuntime', () => {
  it('publishes a verified ready runtime, reuses it offline, and repairs missing assets', async () => {
    const options = await fixture();
    const prepared = await prepareHwpRuntime({ projectDirectory, ...options });
    expect(prepared.reused).toBe(false);
    expect(await readFile(resolve(outputDirectory, 'index.html'), 'utf8')).toContain('HWP editor');
    await expectCleanTemporaryDirectory();

    const reused = await prepareHwpRuntime({ projectDirectory, ...options });
    expect(reused.reused).toBe(true);
    expect(options.fetchArchive).toHaveBeenCalledTimes(1);

    await rm(resolve(outputDirectory, 'assets/runtime.js'));
    const repaired = await prepareHwpRuntime({ projectDirectory, ...options });
    expect(repaired.reused).toBe(false);
    expect(options.fetchArchive).toHaveBeenCalledTimes(2);
    await expectCleanTemporaryDirectory();
  });

  it('rejects the wrong checksum without replacing existing public assets', async () => {
    const options = await fixture();
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(resolve(outputDirectory, 'index.html'), 'existing runtime');
    options.descriptor.sha256 = '0'.repeat(64);
    await expect(prepareHwpRuntime({ projectDirectory, ...options })).rejects.toThrow('SHA256 mismatch');
    expect(await readFile(resolve(outputDirectory, 'index.html'), 'utf8')).toBe('existing runtime');
    await expectCleanTemporaryDirectory();
  });

  it.each([
    ['0.8.6-other', basePath],
    ['0.8.6-dsub.2', '/wrong-base/'],
  ])('rejects mismatched manifest pins %s %s', async (buildId, manifestBasePath) => {
    const options = await fixture(true, buildId, manifestBasePath);
    await expect(prepareHwpRuntime({ projectDirectory, ...options })).rejects.toThrow('manifest does not match');
    await expectCleanTemporaryDirectory();
  });

  it('rejects an incomplete verified archive and cleans up download failures', async () => {
    const options = await fixture(false);
    await expect(prepareHwpRuntime({ projectDirectory, ...options })).rejects.toThrow();
    await expectCleanTemporaryDirectory();
    options.fetchArchive.mockImplementation(async () => new Response('unavailable', { status: 503 }));
    await expect(prepareHwpRuntime({ projectDirectory, ...options })).rejects.toThrow('download failed: 503');
    await expectCleanTemporaryDirectory();
  });
});
