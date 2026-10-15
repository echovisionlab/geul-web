#!/usr/bin/env node
// Computes which message paths each client message scope (route group) needs and writes
// lib/i18n/client-message-scopes.generated.ts and lib/i18n/client-message-routes.generated.ts.
//
//   pnpm i18n:scopes          regenerate after adding or moving useTranslations() calls or routes
//   pnpm i18n:check           (also) fails when a generated file is stale or the route table
//                             disagrees with App Router matching
//
// The route table lists every App Router page pattern with its scope (by first URL segment) and
// whether it renders an editor for ?edit=true. The runtime resolver
// (lib/i18n/client-message-route-match.ts) matches a path against it with App Router precedence,
// so a path that only looks like a route group (`/forms/a/b`, `/oauth/help`) resolves to the CMS
// catch-all page that actually serves it. Every page is mapped to a scope once as-is and once
// with ?edit=true. A page's entries are the page plus the layout/error/not-found/loading/template
// files of its ancestors. The client-reachable modules of those entries
// (scripts/i18n/client-namespace-graph.mjs) give the message paths the scope must ship.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectClientMessagePaths } from './client-namespace-graph.mjs';
import {
  CLIENT_MESSAGE_SCOPES,
  resolveClientMessageScopeForRoutes,
} from '../../lib/i18n/client-message-route-match.ts';

const require = createRequire(import.meta.url);

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const GENERATED_PATH = 'lib/i18n/client-message-scopes.generated.ts';
export const ROUTES_GENERATED_PATH = 'lib/i18n/client-message-routes.generated.ts';

/** Scope of a page route by its first URL segment; other routes (and the CMS catch-all) are `public`. */
export const ROUTE_SCOPE_ROOTS = {
  admin: 'admin',
  my: 'account',
  login: 'auth',
  account: 'auth',
  verify: 'auth',
  oauth: 'auth',
  onboarding: 'auth',
  subscribe: 'auth',
  unsubscribe: 'auth',
  campaigns: 'editor',
  'editor-lab-local': 'editor',
  forms: 'forms',
};

/**
 * Paths that look like a route group but are not one of its routes, checked (with and without
 * ?edit=true) against App Router matching in addition to every page pattern and its neighbours.
 */
export const AMBIGUOUS_ROUTE_PROBES = [
  '/forms/team/about',
  '/forms/team/about/history',
  '/oauth/help',
  '/oauth/authorize',
  '/account',
  '/account/help',
  '/admin/team',
  '/admin/team/about',
  '/admin/users/example/notes',
  '/admin/forms/example/builder/extra',
  '/my-something',
  '/mypage',
  '/my/unknown',
  '/my/unknown/deep',
  '/login/help',
  '/campaigns',
  '/subscribe/help/deep',
  '/editor-lab-local/notes',
  '/s/token/extra',
  '/posts/example/extra',
];

/**
 * Modules that a public route renders only for ?edit=true. They are skipped when a page is
 * analysed without ?edit=true and included in the `editor` scope. Each must be imported by a
 * page that branches on the edit query (checked by lib/i18n/client-message-scopes.test.ts).
 */
export const EDIT_MODE_MODULES = [
  'features/page/PageEditor/LazyPageEditor.tsx',
  'features/release/ReleaseEditor/LazyReleaseEditor.tsx',
  'features/label/LazyAdminLabelDetailClient.tsx',
  'features/policy/LazyPrivacyEditor.tsx',
  'features/policy/LazyTermsEditor.tsx',
  'features/form/LazyFormEditRoute.tsx',
  'app/(general)/posts/[idOrSlug]/PostEditRoute.tsx',
  'app/(general)/artists/[idOrSlug]/ArtistEditRoute.tsx',
  'app/(general)/works/[idOrSlug]/WorkEditRoute.tsx',
  'app/(general)/events/[idOrSlug]/ProgramEventEditRoute.tsx',
  'app/(general)/event-series/[idOrSlug]/ProgramEventSeriesEditRoute.tsx',
];

/**
 * Extra scopes whose paths a scope's catalogue also carries, so that client navigation between
 * them keeps the inlined catalogue instead of loading the complete one. Public pages link to
 * public forms (embedded form blocks, menus); the forms-only paths are small. Editors return to
 * the public view of what they edit (and its lists). Applied in this order.
 */
export const SCOPE_INCLUDES = {
  public: ['forms'],
  editor: ['public'],
};

const SEGMENT_FILES = ['layout.tsx', 'template.tsx', 'error.tsx', 'not-found.tsx', 'loading.tsx'];

function toPosix(path) {
  return path.split(sep).join('/');
}

function listPages(directory, out = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      // Private folders (`_name`) are not routes.
      if (!entry.name.startsWith('_')) listPages(path, out);
    } else if (entry.name === 'page.tsx') out.push(path);
  }
  return out;
}

/** `app/(general)/posts/[idOrSlug]/page.tsx` → `/posts/example`. */
export function representativePath(pageFile) {
  const segments = toPosix(pageFile).split('/').slice(1, -1); // drop app/ and page.tsx
  const pathSegments = segments
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')))
    .map((segment) => {
      if (segment.startsWith('[[...')) return null;
      if (segment.startsWith('[...')) return 'example-page';
      if (segment.startsWith('[')) return 'example';
      return segment;
    })
    .filter((segment) => segment !== null);
  return `/${pathSegments.join('/')}`;
}

function segmentEntries(root, pageFile) {
  const directories = toPosix(dirname(pageFile)).split('/');
  const entries = [];
  for (let depth = 1; depth <= directories.length; depth += 1) {
    const directory = directories.slice(0, depth).join('/');
    for (const file of SEGMENT_FILES) {
      try {
        readFileSync(join(root, directory, file));
        entries.push(`${directory}/${file}`);
      } catch {
        // segment file absent
      }
    }
  }
  entries.push(toPosix(pageFile));
  return entries;
}

function routeSegments(pageFile) {
  return toPosix(pageFile)
    .split('/')
    .slice(1, -1) // drop app/ and page.tsx
    .filter((segment) => !(segment.startsWith('(') && segment.endsWith(')')));
}

/** `app/(general)/posts/[idOrSlug]/page.tsx` → `/posts/*` (`*` dynamic segment, `**` catch-all). */
export function routePattern(pageFile) {
  const segments = routeSegments(pageFile).map((segment) => {
    if (segment.startsWith('@') || segment.startsWith('(.') || segment.startsWith('[[...')) {
      throw new Error(`Unsupported route segment ${segment} in ${pageFile}; extend client-message-route-match.ts`);
    }
    if (segment.startsWith('[...')) return '**';
    if (segment.startsWith('[')) return '*';
    return segment;
  });
  return `/${segments.join('/')}`;
}

/** App Router route (`/posts/[idOrSlug]`) of a page or route handler file. */
function nextRoute(file) {
  return `/${routeSegments(file).join('/')}`;
}

function scopeOfPattern(pattern) {
  return ROUTE_SCOPE_ROOTS[pattern.split('/')[1]] ?? 'public';
}

const editModeImport = (source) =>
  EDIT_MODE_MODULES.some((module) => {
    const basename = module
      .replace(/\.tsx?$/, '')
      .split('/')
      .at(-1);
    return new RegExp(`from '([^']*/)?${basename}'|import\\('([^']*/)?${basename}'\\)`).test(source);
  });

function listPageFiles(root) {
  return listPages(join(root, 'app'))
    .map((absolute) => toPosix(relative(root, absolute)))
    .sort();
}

/**
 * Page routes with their scope; `editable` routes render their editor (an EDIT_MODE_MODULES module)
 * for ?edit=true. Throws when a page branches on the edit query without being editable or `editor`.
 */
export function clientMessageRoutes(root = REPO_ROOT) {
  return listPageFiles(root).map((pageFile) => {
    const pattern = routePattern(pageFile);
    const scope = scopeOfPattern(pattern);
    const source = readFileSync(join(root, pageFile), 'utf8');
    const editable = editModeImport(source);
    if (!editable && scope !== 'editor' && /isEntityEditView\(|\.edit\b/.test(source)) {
      throw new Error(`${pageFile} branches on ?edit=true but imports no EDIT_MODE_MODULES module`);
    }
    return { pageFile, pattern, nextRoute: nextRoute(pageFile), scope, editable };
  });
}

/** The table that lib/i18n/client-message-routes.generated.ts exports. */
export function clientMessageRouteTable(routes = clientMessageRoutes()) {
  const scopes = Object.fromEntries(
    CLIENT_MESSAGE_SCOPES.map((scope) => [
      scope,
      routes
        .filter((route) => route.scope === scope)
        .map((route) => route.pattern)
        .sort()
        .join(' '),
    ]),
  );
  const editable = routes
    .filter((route) => route.editable)
    .map((route) => route.pattern)
    .sort()
    .join(' ');
  return { scopes, editable };
}

/** Pages with their scope for the plain and the ?edit=true request. */
export function routeScopeAssignments(root = REPO_ROOT) {
  const table = clientMessageRouteTable(clientMessageRoutes(root));
  return listPageFiles(root).flatMap((pageFile) => {
    const path = representativePath(pageFile);
    const entries = segmentEntries(root, pageFile);
    return [
      { pageFile, path, editMode: false, scope: resolveClientMessageScopeForRoutes(table, path), entries },
      {
        pageFile,
        path: `${path}?edit=true`,
        editMode: true,
        scope: resolveClientMessageScopeForRoutes(table, `${path}?edit=true`),
        entries,
      },
    ];
  });
}

function listRouteHandlers(directory, out = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!entry.name.startsWith('_')) listRouteHandlers(path, out);
    } else if (/^route\.(ts|tsx|js)$/.test(entry.name)) out.push(path);
  }
  return out;
}

/**
 * Compares the resolver with App Router matching (Next's own route sorting and route regexes) for
 * every page pattern, paths one segment deeper or beside each pattern, and AMBIGUOUS_ROUTE_PROBES,
 * each with and without ?edit=true. Returns the mismatches.
 */
export function verifyClientMessageRoutes(root = REPO_ROOT, table) {
  const { getSortedRoutes } = require('next/dist/shared/lib/router/utils/sorted-routes');
  const { getRouteRegex } = require('next/dist/shared/lib/router/utils/route-regex');
  const routes = clientMessageRoutes(root);
  const routeTable = table ?? clientMessageRouteTable(routes);
  const pages = new Map(routes.map((route) => [route.nextRoute, route]));
  const handlers = new Set(
    listRouteHandlers(join(root, 'app')).map((file) => nextRoute(toPosix(relative(root, file)))),
  );
  const matchers = getSortedRoutes([...pages.keys(), ...handlers]).map((route) => ({
    route,
    regex: getRouteRegex(route).re,
  }));

  const probes = new Set(AMBIGUOUS_ROUTE_PROBES);
  for (const route of routes) {
    const path = representativePath(route.pageFile);
    probes.add(path);
    probes.add(`${path === '/' ? '' : path}/example-extra`);
    const parent = path.split('/').slice(0, -1).join('/');
    probes.add(`${parent}/example-unknown`);
    probes.add(`${parent}/example-unknown/example-extra`);
  }

  const mismatches = [];
  for (const probe of [...probes].sort()) {
    const served = matchers.find(({ regex }) => regex.test(probe))?.route;
    if (served !== undefined && handlers.has(served) && !pages.has(served)) continue; // route handler, no catalogue
    const page = served === undefined ? undefined : pages.get(served);
    const scope = page?.scope ?? 'public';
    for (const [path, expected] of [
      [probe, scope],
      [`${probe}?edit=true`, page?.editable ? 'editor' : scope],
    ]) {
      const actual = resolveClientMessageScopeForRoutes(routeTable, path);
      if (actual !== expected) {
        mismatches.push(`${path}: resolves to ${actual}, served by ${page?.pageFile ?? 'no page'} (${expected})`);
      }
    }
  }
  return mismatches;
}

function readEnglish(root) {
  return JSON.parse(readFileSync(join(root, 'messages/en.json'), 'utf8'));
}

function hasMessagePath(tree, path) {
  let current = tree;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) return false;
    current = current[segment];
  }
  return true;
}

/** Drops paths that are not in English (strings that only look like keys) or that an ancestor covers. */
export function minimizeMessagePaths(paths, english) {
  const existing = [...new Set(paths)].filter((path) => hasMessagePath(english, path)).sort();
  return existing.filter((path) => !existing.some((other) => other !== path && path.startsWith(`${other}.`)));
}

/**
 * Required message paths per scope, with the module that first requests each path.
 * @returns {{ scopes: Record<string, Map<string, string>>; unresolvedDynamicCalls: string[]; importChain: (scope: string, module: string) => string[] }}
 */
export function analyzeClientMessageScopes(root = REPO_ROOT) {
  const english = readEnglish(root);
  const knownNamespaces = Object.keys(english);
  const cache = new Map();
  const editModeModules = new Set(EDIT_MODE_MODULES);
  const groups = new Map(); // `${scope}:${renders edit-mode modules}` -> entries
  for (const assignment of routeScopeAssignments(root)) {
    if (!assignment.scope) throw new Error(`No client message scope for ${assignment.path} (${assignment.pageFile})`);
    // Edit-only modules render only where ?edit=true selects the editor (an editable route).
    const key = `${assignment.scope}:${assignment.editMode && assignment.scope === 'editor'}`;
    if (!groups.has(key)) groups.set(key, new Set());
    for (const entry of assignment.entries) groups.get(key).add(entry);
  }

  const scopes = Object.fromEntries(CLIENT_MESSAGE_SCOPES.map((scope) => [scope, new Map()]));
  const chains = new Map();
  const unresolvedDynamicCalls = new Set();
  for (const [key, entries] of groups) {
    const [scope, editMode] = key.split(':');
    const result = collectClientMessagePaths({
      root,
      entries: [...entries].sort(),
      knownNamespaces,
      cache,
      exclude: editMode === 'true' ? undefined : (path) => editModeModules.has(path),
    });
    for (const [path, module] of result.required) {
      if (!scopes[scope].has(path)) scopes[scope].set(path, module);
    }
    for (const call of result.unresolvedDynamicCalls) unresolvedDynamicCalls.add(call);
    chains.set(scope, [...(chains.get(scope) ?? []), result.importChain]);
  }

  for (const [scope, included] of Object.entries(SCOPE_INCLUDES)) {
    for (const other of included) {
      for (const [path, module] of scopes[other]) {
        if (!scopes[scope].has(path)) scopes[scope].set(path, module);
      }
    }
  }

  return {
    scopes,
    unresolvedDynamicCalls: [...unresolvedDynamicCalls].sort(),
    importChain(scope, module) {
      for (const chain of chains.get(scope) ?? []) {
        const found = chain(module);
        if (found.length > 1 || found[0] !== module) return found;
      }
      return [module];
    },
  };
}

export function renderGeneratedScopes(scopes, english) {
  const lines = [
    '// Generated by `pnpm i18n:scopes` (scripts/i18n/client-message-scopes.mjs). Do not edit.',
    '// Message paths (namespaces or sub-trees of messages/en.json) that client components can',
    '// request in each route group. Server-only: the client provider uses scope coverage only.',
    "import type { ClientMessageScope } from './client-message-scope';",
    '',
    'export const CLIENT_MESSAGE_SCOPE_PATHS: Record<ClientMessageScope, readonly string[]> = {',
  ];
  for (const scope of CLIENT_MESSAGE_SCOPES) {
    lines.push(`  ${scope}: [`);
    for (const path of minimizeMessagePaths(scopes[scope].keys(), english)) lines.push(`    '${path}',`);
    lines.push('  ],');
  }
  lines.push('};', '');
  return lines.join('\n');
}

export function renderGeneratedRoutes(table) {
  const lines = [
    '// Generated by `pnpm i18n:scopes` (scripts/i18n/client-message-scopes.mjs). Do not edit.',
    '// App Router page patterns per client message scope (`*` dynamic segment, `**` catch-all) and',
    '// the patterns that render an editor for ?edit=true. Client-safe; see client-message-route-match.ts.',
    "import type { ClientMessageRouteTable } from './client-message-route-match';",
    '',
    'export const CLIENT_MESSAGE_ROUTES: ClientMessageRouteTable = {',
    '  scopes: {',
    ...CLIENT_MESSAGE_SCOPES.map((scope) => `    ${scope}: '${table.scopes[scope]}',`),
    '  },',
    `  editable: '${table.editable}',`,
    '};',
    '',
  ];
  return lines.join('\n');
}

async function formatTypeScript(source, filepath) {
  const prettier = await import('prettier');
  const options = (await prettier.resolveConfig(filepath)) ?? {};
  return prettier.format(source, { ...options, filepath });
}

async function writeOrCheck(relativePath, rendered, check) {
  const target = join(REPO_ROOT, relativePath);
  const formatted = await formatTypeScript(rendered, target);
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    // first generation
  }
  if (check) {
    if (current !== formatted) {
      console.error(`${relativePath} is stale. Run \`pnpm i18n:scopes\` and commit the result.`);
      return false;
    }
    console.log(`${relativePath} is up to date`);
    return true;
  }
  if (current !== formatted) writeFileSync(target, formatted);
  console.log(`${current === formatted ? 'Unchanged' : 'Wrote'} ${relativePath}`);
  return true;
}

async function main(argv) {
  const check = argv.includes('--check');
  const routeTable = clientMessageRouteTable();
  const mismatches = verifyClientMessageRoutes(REPO_ROOT, routeTable);
  if (mismatches.length > 0) {
    console.error('The client message route table disagrees with App Router matching:');
    for (const mismatch of mismatches) console.error(`  ${mismatch}`);
    return 1;
  }
  const { scopes, unresolvedDynamicCalls } = analyzeClientMessageScopes();
  if (unresolvedDynamicCalls.length > 0) {
    console.error('Translation calls with a non-literal namespace must be listed in DYNAMIC_TRANSLATION_SOURCES');
    console.error('(scripts/i18n/client-namespace-graph.mjs):');
    for (const call of unresolvedDynamicCalls) console.error(`  ${call}`);
    return 1;
  }
  const routesOk = await writeOrCheck(ROUTES_GENERATED_PATH, renderGeneratedRoutes(routeTable), check);
  const scopesOk = await writeOrCheck(GENERATED_PATH, renderGeneratedScopes(scopes, readEnglish(REPO_ROOT)), check);
  return routesOk && scopesOk ? 0 : 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
