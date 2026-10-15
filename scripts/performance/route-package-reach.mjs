import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import ts from '@typescript/tooling';

// Which App Router routes can reach a package, and whether only through `import()`.
// Follows value imports of every local module (server and client) from a route's page and its
// ancestor layouts/boundaries. Type-only imports and `'use server'` modules are skipped (the client
// receives action references, not their code). A static reach means the package is on the route's
// render path (first load if the importer is a client module); a dynamic-only reach means it can
// load later behind `import()` / `next/dynamic`. This is an over-approximation: it does not know
// which branch renders. Use it to place providers (for example `QueryClientProvider`) and to
// verify that a route no longer reaches a package.
//
//   node scripts/performance/route-package-reach.mjs [root] --package @tanstack/react-query
//        [--exclude lib/providers/ReactQueryProvider.tsx] [--why /posts/[idOrSlug]] [--boundaries] [--json]
//
// `--exclude` (repeatable) stops traversal at a module, e.g. the provider being placed.
// `--boundaries` lists, for dynamic-only routes, the `import()` sites whose targets reach the package
// statically: the lazy roots that must bring their own provider.
// `query-provider-placement.test.ts` uses `analyzeRoutes` to enforce React Query provider placement.

const extensions = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx'];
const boundaryFiles = ['layout', 'template', 'error', 'loading', 'not-found', 'default'];
const isTestModule = (file) => /(?:\.test|\.stories|\.story|\.type-test)\.tsx?$/.test(file);

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

function parseSource(file) {
  const sourceFile = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let useServer = false;
  for (const statement of sourceFile.statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) break;
    if (statement.expression.text === 'use server') useServer = true;
  }
  const edges = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyImport(node)) edges.push({ specifier: node.moduleSpecifier.text, dynamic: false });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      if (!isTypeOnlyExport(node)) edges.push({ specifier: node.moduleSpecifier.text, dynamic: false });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      edges.push({ specifier: node.arguments[0].text, dynamic: true });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return { useServer, edges };
}

/**
 * Analyses every `page.tsx` under `app/`. Each row: `route`, `page` (relative path), `entries` (page
 * plus ancestor layouts/boundaries, relative), `reach` ('static' | 'dynamic' | 'none'), `chains`
 * (one import chain per reached specifier) and `boundaries` (import() sites, for dynamic rows).
 * @param {{ root?: string; packages?: string[]; exclude?: string[] }} [options]
 */
export function analyzeRoutes({ root: rootArgument = '.', packages = ['@tanstack/react-query'], exclude = [] } = {}) {
  const root = resolve(rootArgument);
  const wanted = new Set(packages);
  const excluded = new Set(exclude.map((path) => resolve(root, path)));
  const parsed = new Map();
  const parse = (file) => {
    let module = parsed.get(file);
    if (!module) {
      module = parseSource(file);
      parsed.set(file, module);
    }
    return module;
  };
  const matches = (specifier) => wanted.has(specifier) || [...wanted].some((name) => specifier.startsWith(`${name}/`));
  const resolveLocal = (from, specifier) => {
    let base;
    if (specifier.startsWith('@/')) base = join(root, specifier.slice(2));
    else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
    else return null;
    for (const extension of extensions) {
      const candidate = `${base}${extension}`;
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
    }
    return null;
  };

  /** Breadth-first reach; a hit is `dynamic` when every path to it crosses an `import()`. */
  const reach = (entries) => {
    const best = new Map(entries.map((file) => [file, { dynamic: false, parent: null }]));
    const queue = [...entries];
    const hits = new Map();
    while (queue.length > 0) {
      const file = queue.shift();
      const state = best.get(file);
      for (const edge of parse(file).edges) {
        const dynamic = state.dynamic || edge.dynamic;
        if (matches(edge.specifier)) {
          const hit = hits.get(edge.specifier);
          if (!hit || (hit.dynamic && !dynamic)) hits.set(edge.specifier, { dynamic, via: file });
          continue;
        }
        const target = resolveLocal(file, edge.specifier);
        if (!target || excluded.has(target) || isTestModule(target) || parse(target).useServer) continue;
        const previous = best.get(target);
        if (previous && (!previous.dynamic || dynamic)) continue;
        best.set(target, { dynamic, parent: file });
        queue.push(target);
      }
    }
    return { hits, best };
  };
  const chain = (best, file) => {
    const result = [];
    for (let current = file; current; current = best.get(current)?.parent ?? null) {
      result.unshift(relative(root, current));
    }
    return result;
  };
  const boundariesOf = (entries) => {
    const { best } = reach(entries);
    const result = new Set();
    for (const [file, state] of best) {
      if (state.dynamic) continue;
      for (const edge of parse(file).edges) {
        if (!edge.dynamic) continue;
        const target = resolveLocal(file, edge.specifier);
        if (!target || excluded.has(target) || isTestModule(target)) continue;
        if ([...reach([target]).hits.values()].some((hit) => !hit.dynamic)) {
          result.add(`${relative(root, file)} -> import('${edge.specifier}')`);
        }
      }
    }
    return [...result].sort();
  };
  const walkPages = (directory) =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : walkPages(path);
      return /^page\.tsx?$/.test(entry.name) ? [path] : [];
    });
  const entriesFor = (page) => {
    const entries = [page];
    for (let directory = dirname(page); ; directory = dirname(directory)) {
      for (const name of boundaryFiles) {
        for (const extension of ['.tsx', '.ts']) {
          const file = join(directory, `${name}${extension}`);
          if (existsSync(file)) entries.push(file);
        }
      }
      if (directory === join(root, 'app')) break;
    }
    return entries;
  };
  return walkPages(join(root, 'app'))
    .map((page) => {
      const entries = entriesFor(page);
      const { hits, best } = reach(entries);
      const kind = hits.size === 0 ? 'none' : [...hits.values()].some((hit) => !hit.dynamic) ? 'static' : 'dynamic';
      const segments = relative(join(root, 'app'), dirname(page))
        .split(sep)
        .filter((segment) => segment && !segment.startsWith('('));
      return {
        route: `/${segments.join('/')}`,
        page: relative(root, page),
        entries: entries.map((file) => relative(root, file)),
        reach: kind,
        chains: [...hits].map(([specifier, hit]) => ({
          specifier,
          dynamic: hit.dynamic,
          chain: chain(best, hit.via),
        })),
        boundaries: kind === 'dynamic' ? boundariesOf(entries) : [],
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const options = (name) => args.flatMap((value, index) => (args[index - 1] === name ? [value] : []));
  const optionNames = new Set(['--package', '--exclude', '--why']);
  const root = args.find((value, index) => !value.startsWith('--') && !optionNames.has(args[index - 1])) ?? '.';
  const packages = options('--package');
  const rows = analyzeRoutes({
    root,
    packages: packages.length > 0 ? packages : undefined,
    exclude: options('--exclude'),
  });
  const why = options('--why')[0];
  if (why) {
    const row = rows.find((candidate) => candidate.route === why);
    if (!row) throw new Error(`Unknown route ${why}`);
    for (const hit of row.chains) {
      console.log(`${hit.specifier} (${hit.dynamic ? 'dynamic' : 'static'})\n  ${hit.chain.join('\n  -> ')}`);
    }
  } else if (args.includes('--boundaries')) {
    const all = new Map();
    for (const row of rows) {
      for (const boundary of row.boundaries) all.set(boundary, [...(all.get(boundary) ?? []), row.route]);
    }
    for (const [boundary, routes] of [...all].sort()) console.log(`${boundary}\n    ${routes.join(' ')}`);
  } else if (args.includes('--json')) {
    console.log(
      JSON.stringify(
        rows.map(({ route, page, reach }) => ({ route, page, reach })),
        null,
        2,
      ),
    );
  } else {
    for (const kind of ['static', 'dynamic', 'none']) {
      const selected = rows.filter((row) => row.reach === kind);
      console.log(`${kind} (${selected.length})`);
      for (const row of selected) console.log(`  ${row.route}`);
    }
  }
}
