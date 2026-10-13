import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Largest client modules for one route from `next experimental-analyze --output`
// (Next 16.3 analyze.data: length-prefixed JSON graph followed by binary indexes).
// The analyzer is a separate compilation; it includes lazy (dynamic import) chunks,
// so this attributes size to modules/packages but is not a first-load measurement.
//
//   node scripts/performance/next-analyzer-modules.mjs <root> <route-dir, e.g. login> [--top 40] [--grep <text>]
const [rootArgument = '.', route = '', ...options] = process.argv.slice(2);
const option = (name) => {
  const index = options.indexOf(name);
  return index < 0 ? null : options[index + 1];
};
const top = Number(option('--top') ?? 40);
const filter = option('--grep');
const root = resolve(rootArgument);
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
const modules = new Map();
for (const part of graph.chunk_parts) {
  const file = graph.output_files[part.output_file_index].filename;
  if (!file.includes('/static/')) continue;
  const path = sourcePath(part.source_index).replace(/^\[project\]\//, '');
  const entry = modules.get(path) ?? { path, size: 0, compressed: 0, chunks: new Set() };
  entry.size += part.size;
  entry.compressed += part.compressed_size;
  entry.chunks.add(file.replace(/^.*\/chunks\//, ''));
  modules.set(path, entry);
}
const packageOf = (path) => {
  const match = path.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
  return match ? match[1] : path.split('/').slice(0, 3).join('/');
};
const packages = new Map();
for (const entry of modules.values()) {
  const name = packageOf(entry.path);
  const value = packages.get(name) ?? { name, size: 0, compressed: 0, modules: 0 };
  value.size += entry.size;
  value.compressed += entry.compressed;
  value.modules += 1;
  packages.set(name, value);
}
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} kB`.padStart(10);
const list = [...modules.values()].filter((entry) => !filter || entry.path.includes(filter));
const total = list.reduce((sum, entry) => sum + entry.compressed, 0);
console.log(`${route}: ${list.length} client modules, ${kb(total)} compressed (includes lazy chunks)`);
console.log('\nPackages / top-level source directories (compressed):');
for (const value of [...packages.values()].sort((a, b) => b.compressed - a.compressed).slice(0, top)) {
  console.log(`${kb(value.compressed)} ${String(value.modules).padStart(5)}  ${value.name}`);
}
console.log('\nModules (compressed, raw):');
for (const entry of list.sort((a, b) => b.compressed - a.compressed).slice(0, top)) {
  console.log(`${kb(entry.compressed)} ${kb(entry.size)}  ${entry.path}`);
}
