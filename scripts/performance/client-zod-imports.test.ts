import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildClientGraph, importChain, packageReaches } from './client-module-graph.mjs';

// Classic `zod` cannot be tree-shaken: any client-reachable import ships about 90 kB gzip of it to
// every route that loads the module (statically or as a lazy chunk). Client code validates with
// `zod/mini` through `@/lib/zod-mini`, which also installs the English messages classic zod used.
// Server-only modules (never reached from a 'use client' graph) may keep classic zod.
const root = resolve(__dirname, '../..');
const graph = buildClientGraph(root);

const ZOD_MINI_ENTRY = 'lib/zod-mini/index.ts';
const ZOD_MINI_ENTRY_IMPORTS = new Set(['zod/mini', 'zod/v4/locales/en.js']);

/**
 * Geul Common modules that validate with classic zod and are imported by client code. Common 0.5.0
 * moved every schema to `zod/mini`, so this must stay empty: a Common release that reintroduces
 * classic zod fails here instead of adding about 90 kB gzip to editor routes.
 */
const COMMON_CLASSIC_ZOD_IMPORTS: Record<string, { static?: string[]; dynamic?: string[] }> = {};
const COMMON = '@echovisionlab/geul-common/';

function describeChain(path: string) {
  return importChain(graph, path).join(' -> ');
}

describe('client zod imports', () => {
  it('finds the client graph', () => {
    expect(graph.has(ZOD_MINI_ENTRY)).toBe(true);
    expect(graph.size).toBeGreaterThan(500);
  });

  it('keeps classic zod out of client-reachable modules', () => {
    const violations = [...graph]
      .flatMap(([path, module]) =>
        module.packages
          .filter((specifier: string) => specifier === 'zod' || specifier.startsWith('zod/'))
          .filter((specifier: string) => !(path === ZOD_MINI_ENTRY && ZOD_MINI_ENTRY_IMPORTS.has(specifier)))
          .map((specifier: string) => `${specifier} imported by ${describeChain(path)}`),
      )
      .sort();
    expect(violations).toEqual([]);
  });

  it('routes client zod/mini imports through @/lib/zod-mini (English messages)', () => {
    const graphWithoutEntry = [...graph].filter(([path]) => path !== ZOD_MINI_ENTRY);
    const direct = graphWithoutEntry.filter(([, module]) => module.packages.includes('zod/mini')).map(([path]) => path);
    expect(direct).toEqual([]);
  });

  it('does not add client imports of Geul Common modules that use classic zod', () => {
    const actual: Record<string, { static?: string[]; dynamic?: string[] }> = {};
    for (const [path, module] of graph) {
      for (const specifier of module.packages) {
        if (!specifier.startsWith(COMMON) || !packageReaches(root, specifier, 'zod')) {
          continue;
        }
        const kind = module.dynamicPackages.includes(specifier) ? 'dynamic' : 'static';
        const entry = (actual[path] ??= {});
        (entry[kind] ??= []).push(specifier.slice(COMMON.length));
      }
    }
    for (const entry of Object.values(actual)) {
      entry.static?.sort();
      entry.dynamic?.sort();
    }
    expect(actual).toEqual(COMMON_CLASSIC_ZOD_IMPORTS);
  });
});
