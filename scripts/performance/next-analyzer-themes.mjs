import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Next 16.3.1's analyze.data stores a length-prefixed JSON graph followed by
// binary indexes. This reads only that graph; it does not infer initial loading.
const root = resolve(process.argv[2] || '.');
const route = process.argv[3] || 'posts/[idOrSlug]';
const data = readFileSync(resolve(root, '.next/diagnostics/analyze/data', route, 'analyze.data'));
const length = data.readUInt32BE(0);
if (length > data.length - 4) throw new Error('Unsupported analyzer artifact');
const graph = JSON.parse(data.subarray(4, 4 + length).toString('utf8'));
const paths = new Map();
function sourcePath(index) {
  if (paths.has(index)) return paths.get(index);
  const source = graph.sources[index];
  const parent = source.parent_source_index;
  const path = `${parent == null ? '' : `${sourcePath(parent)}/`}${source.path}`.replaceAll('//', '/');
  paths.set(index, path);
  return path;
}
const clientSources = new Set(
  graph.chunk_parts
    .filter((part) => graph.output_files[part.output_file_index].filename.includes('/static/'))
    .map((part) => part.source_index),
);
const themes = [
  ...new Set(
    [...clientSources].map(sourcePath).filter((path) => path.includes('/themes/dist/') && path.endsWith('.mjs')),
  ),
].sort();
console.log(
  JSON.stringify(
    {
      kind: 'next-analyzer-client-reachable-themes-including-lazy-not-initial-loading',
      root,
      route,
      count: themes.length,
      themes,
    },
    null,
    2,
  ),
);
