import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// Public view routes must not ship these packages in their first-load client JavaScript.
// Turbopack computes used exports for the whole app, so one value import of a generated enum loads that
// `_pb` file's descriptor, its dependencies and the protobuf registry. Use a constant mirror with an
// equality test (for example `lib/utils/menu.ts`, `features/media-download/download-wire-values.ts`),
// render the data on the server, or load the module with `import()` when an interaction needs it.
// Type-only imports are erased and allowed.
const forbidden: Record<string, string> = {
  '@echovisionlab/geul-proto': 'generated proto values (descriptor + protobuf registry)',
  '@bufbuild/protobuf': 'protobuf runtime',
  '@connectrpc/connect-web': 'browser RPC transport',
  'libphonenumber-js': 'phone metadata; forms load it with their first phone field',
};
// Authoring, account and admin surfaces may load the RPC stack up front.
const exemptRoutes = /^app\/(?:admin|editor-lab-local)\/|^app\/\(general\)\/(?:my|campaigns)\//;
const entryFile = /\/(?:page|layout|template|error|global-error|not-found|loading|default)\.tsx?$/;

const root = resolve(__dirname, '../..');

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path);
    return [path];
  });
}

const resolvedModules = new Map<string, string | null>();

function resolveLocal(from: string, specifier: string) {
  const base = specifier.startsWith('@/') ? join(root, specifier.slice(2)) : resolve(dirname(from), specifier);
  const cached = resolvedModules.get(base);
  if (cached !== undefined) return cached;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx')]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      resolvedModules.set(base, candidate);
      return candidate;
    }
  }
  resolvedModules.set(base, null);
  return null;
}

interface ModuleInfo {
  directive: 'client' | 'server' | null;
  serverOnly: boolean;
  imports: { specifier: string; typeOnly: boolean }[];
}

const staticImport =
  /(?:^|\n)\s*(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g;
const modules = new Map<string, ModuleInfo>();

function moduleInfo(file: string): ModuleInfo {
  const cached = modules.get(file);
  if (cached) return cached;
  const source = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const imports: ModuleInfo['imports'] = [];
  for (const match of source.matchAll(staticImport)) {
    if (match[5]) {
      imports.push({ specifier: match[5], typeOnly: false });
      continue;
    }
    const [, keyword, typeKeyword, clause, specifier] = match;
    if (keyword === 'export' && !/^[{*]/.test(clause.trim())) continue;
    const named = clause.trim().match(/^\{([\s\S]*)\}$/);
    const names = named?.[1]
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    const typeOnly = Boolean(typeKeyword) || Boolean(names?.length && names.every((name) => name.startsWith('type ')));
    imports.push({ specifier, typeOnly });
  }
  const info: ModuleInfo = {
    directive: (source.trimStart().match(/^['"]use (client|server)['"]/)?.[1] as ModuleInfo['directive']) ?? null,
    serverOnly: imports.some((entry) => entry.specifier === 'server-only'),
    imports,
  };
  modules.set(file, info);
  return info;
}

/** Static client-graph imports of forbidden packages reachable from a route entry (server code may use them). */
function clientViolations(entry: string) {
  const visited = new Set<string>();
  const parent = new Map<string, string | null>();
  const queue: [file: string, client: boolean, from: string | null][] = [[entry, false, null]];
  const violations: string[] = [];
  const chain = (key: string) => {
    const files: string[] = [];
    for (let current: string | null | undefined = key; current; current = parent.get(current)) {
      files.unshift(relative(root, current.slice(2)));
    }
    return files.join(' > ');
  };
  while (queue.length > 0) {
    const [file, inheritedClient, from] = queue.shift()!;
    const info = moduleInfo(file);
    const client = inheritedClient || info.directive === 'client';
    // Server actions and server-only modules never reach the browser bundle.
    if (client && (info.directive === 'server' || info.serverOnly)) continue;
    const key = `${client ? 'c' : 's'}:${file}`;
    if (visited.has(key)) continue;
    visited.add(key);
    parent.set(key, from);
    for (const { specifier, typeOnly } of info.imports) {
      if (typeOnly) continue;
      const pkg = Object.keys(forbidden).find((name) => specifier === name || specifier.startsWith(`${name}/`));
      if (pkg) {
        if (client) violations.push(`${specifier} (${forbidden[pkg]})\n    via ${chain(key)}`);
        continue;
      }
      if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue;
      const target = resolveLocal(file, specifier);
      if (target) queue.push([target, client, key]);
    }
  }
  return violations;
}

const entries = walk(join(root, 'app'))
  .filter((file) => entryFile.test(file) && !/\.(?:test|stories)\.tsx?$/.test(file))
  .filter((file) => !exemptRoutes.test(relative(root, file)));

describe('public route client imports', () => {
  it('scans the public route entries', () => {
    expect(entries.map((file) => relative(root, file))).toEqual(
      expect.arrayContaining([
        'app/layout.tsx',
        'app/(general)/posts/[idOrSlug]/page.tsx',
        'app/(general)/privacy/page.tsx',
        'app/(general)/category/[slug]/page.tsx',
        'app/forms/[slug]/page.tsx',
      ]),
    );
  });

  it('keeps generated proto values, the browser RPC stack and phone metadata out of first-load client code', () => {
    const violations = entries.flatMap((entry) =>
      clientViolations(entry).map((violation) => `${relative(root, entry)}: ${violation}`),
    );
    expect(violations).toEqual([]);
  });
});
