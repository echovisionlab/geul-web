import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

const root = resolve(process.argv[2] || '.');
const chunks = resolve(root, '.next/static/chunks');
const files = [];
function collect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (/\.(js|css)$/.test(entry.name)) {
      const data = readFileSync(path);
      files.push({
        path: relative(root, path),
        kind: entry.name.endsWith('.js') ? 'js' : 'css',
        rawBytes: data.length,
        gzipBytes: gzipSync(data, { level: 9 }).length,
        sha256: createHash('sha256').update(data).digest('hex'),
      });
    }
  }
}
collect(chunks);
files.sort((a, b) => a.path.localeCompare(b.path));
const totals = {};
for (const kind of ['js', 'css']) {
  const selected = files.filter((file) => file.kind === kind);
  totals[kind] = {
    files: selected.length,
    rawBytes: selected.reduce((total, file) => total + file.rawBytes, 0),
    gzipBytes: selected.reduce((total, file) => total + file.gzipBytes, 0),
  };
}
console.log(
  JSON.stringify(
    {
      kind: 'next-whole-emitted-static-chunk-graph-including-lazy-not-route-transfer',
      root,
      buildId: readFileSync(resolve(root, '.next/BUILD_ID'), 'utf8').trim(),
      lockfileSha256: createHash('sha256')
        .update(readFileSync(resolve(root, 'pnpm-lock.yaml')))
        .digest('hex'),
      gzipLevel: 9,
      totals,
      files,
    },
    null,
    2,
  ),
);
