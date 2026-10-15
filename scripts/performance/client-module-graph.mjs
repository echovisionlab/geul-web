import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from '@typescript/tooling';

// Static client module graph: every local module reachable from a `'use client'` module (or a
// client-only entry) through value imports, re-exports and dynamic `import()`. Type-only imports
// are skipped. `'use server'` modules are not followed: the client receives server-action
// references, not their code. Bare package specifiers are recorded per module but not followed;
// `packageReaches` follows them inside packages that ship source (for example Geul Common).
//
//   node scripts/performance/client-module-graph.mjs [root] [--package zod] [--why <module>]
//
// With `--package`, prints the client-reachable local modules that import that exact specifier.
// `--why` prints one import chain from a client entry to the module.

const sourceDirectories = ['app', 'features', 'components', 'lib', 'hooks', 'i18n'];
const clientEntries = ['instrumentation-client.ts'];
const excluded = /(?:\.test|\.stories|\.story|\.type-test)\.tsx?$|\/node_modules\//;
const extensions = ['', '.ts', '.tsx', '.mjs', '/index.ts', '/index.tsx'];

function walk(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walk(path);
    return /\.(?:tsx?|mjs)$/.test(entry.name) && !excluded.test(path) ? [path] : [];
  });
}

function isTypeOnlyImport(node) {
  const clause = node.importClause;
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  if (clause.name) return false;
  const bindings = clause.namedBindings;
  if (!bindings || ts.isNamespaceImport(bindings)) return false;
  return bindings.elements.length > 0 && bindings.elements.every((element) => element.isTypeOnly);
}

function isTypeOnlyExport(node) {
  if (node.isTypeOnly) return true;
  const clause = node.exportClause;
  return Boolean(
    clause && ts.isNamedExports(clause) && clause.elements.length > 0 && clause.elements.every((e) => e.isTypeOnly),
  );
}

/**
 * Value import specifiers of one source file (`dynamic` holds those only reached through `import()`)
 * and its `'use client'` / `'use server'` directives.
 */
export function parseModule(file, source = readFileSync(file, 'utf8')) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const specifiers = new Set();
  const dynamic = new Set();
  let useClient = false;
  let useServer = false;
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === 'use client') useClient = true;
    if (statement.expression.text === 'use server') useServer = true;
  }
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node)) specifiers.add(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyExport(node)) specifiers.add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      dynamic.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  for (const specifier of specifiers) dynamic.delete(specifier);
  return { useClient, useServer, specifiers: [...specifiers, ...dynamic], dynamic: [...dynamic] };
}

function resolveFile(base) {
  for (const extension of extensions) {
    const candidate = `${base}${extension}`;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function resolveLocal(root, from, specifier) {
  if (specifier.startsWith('@/')) return resolveFile(join(root, specifier.slice(2)));
  if (specifier.startsWith('.')) return resolveFile(resolve(dirname(from), specifier));
  return null;
}

/**
 * Builds the client-reachable graph. Keys are paths relative to `root`; `packages` lists the bare
 * specifiers a module imports, `dynamicPackages` those it only loads with `import()`.
 */
export function buildClientGraph(root) {
  const files = [
    ...sourceDirectories.flatMap((directory) => walk(join(root, directory))),
    ...clientEntries.map((file) => join(root, file)).filter((file) => existsSync(file)),
  ];
  const modules = new Map();
  const load = (file) => {
    let module = modules.get(file);
    if (!module) {
      const parsed = parseModule(file);
      const local = [];
      const packages = [];
      for (const specifier of parsed.specifiers) {
        const target = resolveLocal(root, file, specifier);
        if (target) local.push(target);
        else if (!specifier.startsWith('.') && !specifier.startsWith('@/')) packages.push(specifier);
      }
      const dynamicPackages = packages.filter((specifier) => parsed.dynamic.includes(specifier));
      module = { useClient: parsed.useClient, useServer: parsed.useServer, local, packages, dynamicPackages };
      modules.set(file, module);
    }
    return module;
  };
  const entries = files.filter((file) => clientEntries.includes(relative(root, file)) || load(file).useClient);
  const parent = new Map(entries.map((file) => [file, null]));
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.shift();
    for (const target of load(file).local) {
      if (excluded.test(target) || parent.has(target) || load(target).useServer) continue;
      parent.set(target, file);
      queue.push(target);
    }
  }
  const reachable = new Map();
  for (const file of parent.keys()) {
    const module = load(file);
    reachable.set(relative(root, file), {
      packages: module.packages,
      dynamicPackages: module.dynamicPackages,
      importedBy: parent.get(file) ? relative(root, parent.get(file)) : null,
    });
  }
  return reachable;
}

export function importChain(graph, path) {
  const chain = [];
  for (let current = path; current; current = graph.get(current)?.importedBy ?? null) chain.unshift(current);
  return chain;
}

function packageEntry(root, specifier) {
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const directory = join(root, 'node_modules', name);
  const manifestPath = join(directory, 'package.json');
  if (!existsSync(manifestPath)) return null;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const subpath = `.${specifier.slice(name.length)}`;
  const target = manifest.exports?.[subpath];
  const file = typeof target === 'string' ? target : (target?.import ?? target?.default);
  return typeof file === 'string' && /\.tsx?$/.test(file) ? resolveFile(join(directory, file)) : null;
}

const reachCache = new Map();

/**
 * Whether a package entry that ships TypeScript source imports `target` (by value), directly or
 * through its own relative imports. Packages that ship built JavaScript are not followed.
 */
export function packageReaches(root, specifier, target) {
  const key = `${root}\0${specifier}\0${target}`;
  if (!reachCache.has(key)) {
    const entry = packageEntry(root, specifier);
    const seen = new Set();
    const visit = (file) => {
      if (seen.has(file)) return false;
      seen.add(file);
      const { specifiers } = parseModule(file);
      if (specifiers.includes(target)) return true;
      return specifiers.some((next) => {
        if (!next.startsWith('.')) return false;
        const resolved =
          resolveFile(resolve(dirname(file), next)) ?? resolveFile(resolve(dirname(file), next.replace(/\.js$/, '')));
        return resolved !== null && visit(resolved);
      });
    };
    reachCache.set(key, entry !== null && visit(entry));
  }
  return reachCache.get(key);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const option = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
  const root = resolve(
    args.find((value, index) => !value.startsWith('--') && !args[index - 1]?.startsWith('--')) ?? '.',
  );
  const graph = buildClientGraph(root);
  const why = option('--why');
  if (why) console.log(importChain(graph, why).join('\n  -> '));
  else {
    const name = option('--package') ?? 'zod';
    for (const [path, module] of [...graph].sort()) if (module.packages.includes(name)) console.log(path);
  }
}
