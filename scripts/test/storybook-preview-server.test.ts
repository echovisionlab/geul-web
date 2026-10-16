// @geul-test-tier node-unit
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { startKitServer } from '../design-system/serve-kit.mjs';

function readPreview(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = get(new URL('index.json', url), (response) => {
      let content = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        content += chunk;
      });
      response.on('error', reject);
      response.on('end', () => resolve(content));
    });
    request.setTimeout(2000, () => request.destroy(new Error('preview request timed out')));
    request.on('error', reject);
  });
}

it('gives concurrent previews separate ports and data, and lets one close without stopping its peer', async () => {
  const directories: string[] = [];
  const previews: Awaited<ReturnType<typeof startKitServer>>[] = [];
  try {
    for (const label of ['first', 'second']) {
      const directory = await mkdtemp(join(tmpdir(), 'geul-storybook-preview-'));
      directories.push(directory);
      await writeFile(join(directory, 'index.json'), JSON.stringify({ owner: label }));
      previews.push(await startKitServer({ directory }));
    }
    expect(previews[0].url).not.toBe(previews[1].url);
    expect(await Promise.all(previews.map((preview) => readPreview(preview.url)))).toEqual([
      '{"owner":"first"}',
      '{"owner":"second"}',
    ]);
    const first = previews.shift()!;
    await first.close();
    expect(await readPreview(previews[0].url)).toBe('{"owner":"second"}');
  } finally {
    try {
      await Promise.all(previews.map((preview) => preview.close()));
    } finally {
      await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })));
    }
  }
});
