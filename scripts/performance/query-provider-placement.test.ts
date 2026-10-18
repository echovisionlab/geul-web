import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyzeRoutes } from './route-package-reach.mjs';

// TanStack Query has no root provider: public routes that do not use it must not load it.
// A route whose render path reaches React Query gets `ReactQueryProvider` from a layout; a lazy root
// that reaches it only behind `import()` wraps itself with `withQueryClient`.
const root = resolve(__dirname, '../..');
const PROVIDER = 'lib/providers/ReactQueryProvider.tsx';
const providerImport = /from '@\/lib\/providers\/ReactQueryProvider'/;
interface Row {
  route: string;
  entries: string[];
  reach: 'static' | 'dynamic' | 'none';
  chains: { specifier: string; chain: string[] }[];
  boundaries: string[];
}
const rows: Row[] = analyzeRoutes({ root, packages: ['@tanstack/react-query'], exclude: [PROVIDER] });
const read = (path: string) => readFileSync(join(root, path), 'utf8');

describe('React Query provider placement', () => {
  it('gives every route that renders React Query clients a provider in its layout chain', () => {
    const missing = rows
      .filter((row) => row.reach === 'static')
      .filter(
        (row) =>
          !row.entries.some((entry) => /(?:^|\/)(?:layout|page)\.tsx$/.test(entry) && providerImport.test(read(entry))),
      )
      .map((row) => `${row.route}: ${row.chains.map((hit) => hit.chain.join(' -> ')).join('; ')}`);
    expect(missing).toEqual([]);
  });

  it('wraps every lazy root that reaches React Query with withQueryClient', () => {
    const unwrapped = [...new Set(rows.flatMap((row) => row.boundaries))].filter((boundary) => {
      const [file, target] = boundary.split(' -> ');
      return !read(file).includes(`withQueryClient(${target}`);
    });
    expect(unwrapped).toEqual([]);
  });

  it('keeps React Query out of the first load of public view routes that do not use it', () => {
    const reach = Object.fromEntries(rows.map((row) => [row.route, row.reach]));
    for (const route of ['/', '/[...slug]', '/artists/[idOrSlug]', '/works/[idOrSlug]', '/login', '/sitemap']) {
      expect(reach[route], route).not.toBe('static');
    }
  });
});
