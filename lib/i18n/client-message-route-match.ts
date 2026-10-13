// Route groups ("scopes") for the client message catalogue: path → scope matching against a
// route table. Client-safe and dependency-free: scripts/i18n/client-message-scopes.mjs uses it
// with the table it derives from app/, and client-message-scope.ts binds the generated table.

export const CLIENT_MESSAGE_SCOPES = ['public', 'auth', 'account', 'admin', 'editor', 'forms'] as const;
export type ClientMessageScope = (typeof CLIENT_MESSAGE_SCOPES)[number];

/** Scopes a catalogue covers; `'all'` for the complete catalogue. */
export type ClientMessageCoverage = readonly ClientMessageScope[] | 'all';

/**
 * The App Router page routes, generated from app/ by `pnpm i18n:scopes`. Each value is a
 * space-separated list of route patterns (`/posts/*`: one dynamic segment, `/**`: catch-all).
 * `editable` lists the routes that render their editor for `?edit=true`.
 */
export interface ClientMessageRouteTable {
  scopes: Record<ClientMessageScope, string>;
  editable: string;
}

interface RouteLeaf {
  scope: ClientMessageScope;
  editable: boolean;
}

interface RouteNode {
  page?: RouteLeaf;
  catchAll?: RouteLeaf;
  dynamic?: RouteNode;
  segments: Map<string, RouteNode>;
}

const routeNode = (): RouteNode => ({ segments: new Map() });

function compileRoutes(table: ClientMessageRouteTable): RouteNode {
  const root = routeNode();
  const editable = new Set(table.editable.split(' '));
  for (const scope of CLIENT_MESSAGE_SCOPES) {
    for (const pattern of table.scopes[scope].split(' ').filter(Boolean)) {
      const leaf = { scope, editable: editable.has(pattern) };
      let node = root;
      for (const segment of pattern.split('/').filter(Boolean)) {
        if (segment === '**') {
          node.catchAll = leaf;
          break;
        }
        if (segment === '*') {
          node.dynamic ??= routeNode();
          node = node.dynamic;
        } else {
          let next = node.segments.get(segment);
          if (!next) {
            next = routeNode();
            node.segments.set(segment, next);
          }
          node = next;
        }
      }
      if (!pattern.endsWith('/**')) {
        node.page = leaf;
      }
    }
  }
  return root;
}

// Same precedence as the App Router: a static segment before a dynamic one before a catch-all,
// falling back to the next candidate when the deeper segments do not match.
function matchRoute(node: RouteNode, segments: readonly string[], index: number): RouteLeaf | undefined {
  if (index === segments.length) {
    return node.page;
  }
  const staticChild = node.segments.get(segments[index]!);
  return (
    (staticChild && matchRoute(staticChild, segments, index + 1)) ??
    (node.dynamic && matchRoute(node.dynamic, segments, index + 1)) ??
    node.catchAll
  );
}

const compiled = new WeakMap<ClientMessageRouteTable, RouteNode>();

/**
 * Scope of an internal path with search. `null` (complete catalogue) for anything that is not a
 * same-origin path. Every other path has a scope: the scope of the App Router page that serves it
 * (a path that only looks like a route group, such as `/forms/a/b`, is a CMS Page served by
 * `app/(general)/[...slug]`, which belongs to `public`). Routes that render their editor for
 * `?edit=true` (and the former `?view=edit`) select `editor` for that query.
 */
export function resolveClientMessageScopeForRoutes(
  routes: ClientMessageRouteTable,
  pathWithSearch: string,
): ClientMessageScope | null {
  if (!pathWithSearch.startsWith('/') || pathWithSearch.startsWith('//')) {
    return null;
  }

  const url = new URL(pathWithSearch, 'http://internal');
  let root = compiled.get(routes);
  if (!root) {
    root = compileRoutes(routes);
    compiled.set(routes, root);
  }
  const route = matchRoute(root, url.pathname.split('/').filter(Boolean), 0) ?? { scope: 'public', editable: false };
  if (
    route.editable &&
    (url.searchParams.getAll('edit').includes('true') || url.searchParams.getAll('view').includes('edit'))
  ) {
    return 'editor';
  }
  return route.scope;
}

export function coversClientMessageScope(coverage: ClientMessageCoverage, scope: ClientMessageScope | null): boolean {
  if (coverage === 'all') {
    return true;
  }
  return scope !== null && coverage.includes(scope);
}
