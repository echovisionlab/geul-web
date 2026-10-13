import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';

// package.json `sideEffects` lets Turbopack/webpack drop unused Core barrel re-exports.
// Anything not listed there may be removed when its exports are unused, so a bare
// `import './module'` (imported only for its side effects) must target a listed file.
const root = resolve(__dirname, '../..');
const sideEffects: string[] = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).sideEffects;
const sourceDirectories = ['app', 'features', 'components', 'lib', 'hooks', 'i18n', '.storybook'];
const rootEntries = ['instrumentation.ts', 'instrumentation-client.ts', 'proxy.ts'];
const excluded = /(?:\.test|\.stories|\.type-test)\.tsx?$|\/node_modules\//;

function patternToRegExp(pattern: string) {
  const glob = pattern
    .replace(/^\.\//, '')
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\u0000')
    .replace(/\*/g, '[^/]*')
    .replace(/\u0000/g, '.*');
  return new RegExp(`^${glob}$`);
}
const matchers = sideEffects.map((pattern) => ({
  pattern,
  test: (path: string) => patternToRegExp(pattern).test(pattern.includes('/') ? path : basename(path)),
}));
const declared = (path: string) => matchers.some((matcher) => matcher.test(path));

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path);
    return /\.(?:tsx?|mjs)$/.test(entry.name) && !excluded.test(path) ? [path] : [];
  });
}
const sources = [
  ...sourceDirectories.flatMap((directory) => walk(join(root, directory))),
  ...rootEntries.map((file) => join(root, file)).filter((file) => existsSync(file)),
];

function resolveLocal(from: string, specifier: string) {
  const base = specifier.startsWith('@/') ? join(root, specifier.slice(2)) : resolve(dirname(from), specifier);
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe('package.json sideEffects declaration', () => {
  it('keeps CSS as a side effect', () => {
    expect(sideEffects).toContain('*.css');
  });

  it('declares every local module imported only for its side effects', () => {
    const undeclared: string[] = [];
    for (const file of sources) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/^\s*import\s+['"]([^'"]+)['"];?\s*$/gm)) {
        const specifier = match[1];
        if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
        const target = resolveLocal(file, specifier);
        if (!target) continue;
        const path = relative(root, target);
        if (!declared(path)) undeclared.push(`${relative(root, file)} -> ${path}`);
      }
    }
    expect(undeclared).toEqual([]);
  });

  it('has no stale patterns', () => {
    const files = [...sources, ...walk(join(root, 'app')), ...walk(join(root, 'lib'))].map((file) =>
      relative(root, file),
    );
    const stale = matchers
      .filter((matcher) => matcher.pattern !== '*.css')
      .filter((matcher) => !files.some((path) => matcher.test(path)))
      .map((matcher) => matcher.pattern);
    expect(stale).toEqual([]);
  });
});
