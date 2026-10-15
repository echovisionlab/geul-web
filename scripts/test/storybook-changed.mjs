#!/usr/bin/env node
// Runs the Storybook test-runner only for stories whose files changed, or whose story files
// import a changed module (one level), against the running dev server.
//
//   node scripts/test/storybook-changed.mjs [--base <git-ref>] [--url http://127.0.0.1:6010] [--workers 4] [--dry-run]
//
// Without --base, "changed" means the working tree relative to HEAD (staged, unstaged and
// untracked files). With --base, it means the diff from that ref.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
};
const base = option('--base', null);
const url = option('--url', 'http://127.0.0.1:6010');
const workers = option('--workers', '4');
const dryRun = args.includes('--dry-run');

function git(...command) {
  return execFileSync('git', command, { encoding: 'utf8' }).split('\n').filter(Boolean);
}

const changed = new Set(
  base
    ? git('diff', '--name-only', base)
    : [...git('diff', '--name-only', 'HEAD'), ...git('ls-files', '--others', '--exclude-standard')],
);
if (changed.size === 0) {
  console.log('storybook-changed: no changed files');
  process.exit(0);
}

const index = await fetch(`${url}/index.json`).then((response) => {
  if (!response.ok) {
    throw new Error(`storybook-changed: ${url}/index.json responded ${response.status}`);
  }
  return response.json();
});

// importPath is "./features/x/Y.stories.tsx" relative to the project root.
const storyFiles = new Map();
for (const entry of Object.values(index.entries)) {
  if (entry.type !== 'story') continue;
  const file = entry.importPath.replace(/^\.\//, '');
  if (!storyFiles.has(file)) storyFiles.set(file, []);
  storyFiles.get(file).push(entry.id);
}

// A story file is selected when it changed itself or transitively imports a changed module
// (including deleted ones). The reverse import graph covers the application source tree.
const SOURCE_ROOTS = ['app', 'components', 'features', 'lib', 'stories', '.storybook'];
const SOURCE_FILE = /\.(tsx?|mjs|jsx?)$/;
function listSources() {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', ...SOURCE_ROOTS], {
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) => SOURCE_FILE.test(file) && existsSync(file));
}
function moduleKey(file) {
  return file.replace(/\.(tsx?|mjs|jsx?|css)$/, '').replace(/\/index$/, '');
}
function importedModuleKeys(file) {
  const source = readFileSync(file, 'utf8');
  const keys = new Set();
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    const resolved = specifier.startsWith('@/')
      ? specifier.slice(2)
      : specifier.startsWith('.')
        ? path.normalize(path.join(path.dirname(file), specifier))
        : null;
    if (resolved) keys.add(moduleKey(resolved));
  }
  return keys;
}

const importers = new Map();
for (const file of listSources()) {
  for (const key of importedModuleKeys(file)) {
    if (!importers.has(key)) importers.set(key, new Set());
    importers.get(key).add(file);
  }
}
const affected = new Set(changed);
const queue = [...changed];
while (queue.length > 0) {
  const file = queue.pop();
  for (const importer of importers.get(moduleKey(file)) ?? []) {
    if (!affected.has(importer)) {
      affected.add(importer);
      queue.push(importer);
    }
  }
}

const selected = new Set();
for (const [file, ids] of storyFiles) {
  if (affected.has(file)) ids.forEach((id) => selected.add(id));
}

if (selected.size === 0) {
  console.log('storybook-changed: no stories affected by the change');
  process.exit(0);
}

// The runner matches test file names, which are the story ids; one alternation covers the set.
// The runner matches full paths of generated "<story-file-id>.test.js" files.
const pattern = `/(${[...selected]
  .map((id) => id.replace(/--.*$/, ''))
  .filter((v, i, a) => a.indexOf(v) === i)
  .join('|')})\\.test\\.js$`;
console.log(`storybook-changed: ${selected.size} stories in ${pattern.split('|').length} story files`);
if (dryRun) {
  console.log([...selected].join('\n'));
  process.exit(0);
}

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'test-storybook',
    '--index-json',
    '--url',
    url,
    '--maxWorkers',
    workers,
    '--',
    '--testPathPatterns',
    // test-storybook joins its arguments into a shell command; quote the alternation.
    `'${pattern}'`,
  ],
  { stdio: 'inherit' },
);
process.exit(result.status ?? 1);
