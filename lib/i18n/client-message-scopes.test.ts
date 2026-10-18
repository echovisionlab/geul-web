import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { isMessagePathCovered } from '@/scripts/i18n/client-namespace-graph.mjs';
import {
  AMBIGUOUS_ROUTE_PROBES,
  REPO_ROOT,
  analyzeClientMessageScopes,
  clientMessageRouteTable,
  routeScopeAssignments,
  verifyClientMessageRoutes,
} from '@/scripts/i18n/client-message-scopes.mjs';
import { CLIENT_MESSAGE_SCOPES, resolveClientMessageScope } from './client-message-scope';
import { CLIENT_MESSAGE_ROUTES } from './client-message-routes.generated';
import { CLIENT_MESSAGE_SCOPE_PATHS } from './client-message-scopes.generated';

// Guard for scoped client catalogues: a client component that calls useTranslations() for a
// namespace its route group does not ship would render raw keys. See docs/i18n.md.

function hasMessagePath(path: string): boolean {
  let current: unknown = enMessages;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || !(segment in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return true;
}

const analysis = analyzeClientMessageScopes();

describe('client message scopes', () => {
  it('maps every App Router page to a scope, with and without ?edit=true', () => {
    const assignments = routeScopeAssignments();
    expect(assignments.length).toBeGreaterThan(100);
    expect(assignments.filter((assignment) => !assignment.scope)).toEqual([]);
  });

  it('knows the namespace of every translation call', () => {
    // Register non-literal useTranslations()/useMessages() calls in DYNAMIC_TRANSLATION_SOURCES.
    expect(analysis.unresolvedDynamicCalls).toEqual([]);
  });

  it.each(CLIENT_MESSAGE_SCOPES)('ships every message path the %s client components request', (scope) => {
    const selected = CLIENT_MESSAGE_SCOPE_PATHS[scope];
    const uncovered = [...analysis.scopes[scope]]
      .filter(([path]) => hasMessagePath(path) && !isMessagePathCovered(path, selected))
      .map(([path, module]) => `${path} <- ${analysis.importChain(scope, module).join(' -> ')}`);
    // Run `pnpm i18n:scopes` to regenerate lib/i18n/client-message-scopes.generated.ts.
    expect(uncovered).toEqual([]);
  });

  it('selects only paths that exist in messages/en.json', () => {
    const unknown = CLIENT_MESSAGE_SCOPES.flatMap((scope) =>
      CLIENT_MESSAGE_SCOPE_PATHS[scope].filter((path) => !hasMessagePath(path)).map((path) => `${scope}: ${path}`),
    );
    expect(unknown).toEqual([]);
  });

  it('ships the root, error and consent messages in every scope', () => {
    for (const scope of CLIENT_MESSAGE_SCOPES) {
      for (const path of ['common.actions', 'common.errors', 'common.states', 'errorPage', 'cookieConsentBanner']) {
        expect(isMessagePathCovered(path, CLIENT_MESSAGE_SCOPE_PATHS[scope]), `${scope}: ${path}`).toBe(true);
      }
    }
  });

  it('keeps editor and administration messages out of the public scope', () => {
    for (const namespace of [
      'adminList',
      'adminShell',
      'pageEditor',
      'postEditor',
      'auth',
      'security',
      'fileManager',
    ]) {
      expect(CLIENT_MESSAGE_SCOPE_PATHS.public, namespace).not.toContain(namespace);
    }
    expect(CLIENT_MESSAGE_SCOPE_PATHS.editor).toEqual(expect.arrayContaining(['pageEditor', 'postEditor']));
    expect(CLIENT_MESSAGE_SCOPE_PATHS.admin).toEqual(expect.arrayContaining(['adminList', 'adminShell']));
  });
});

describe('client message route table', () => {
  it('lists every App Router page (run `pnpm i18n:scopes` after adding or moving a route)', () => {
    expect(CLIENT_MESSAGE_ROUTES).toEqual(clientMessageRouteTable());
  });

  it('resolves like App Router matching, including paths that only look like a route group', () => {
    // Probes every page pattern, paths one segment deeper or beside it and AMBIGUOUS_ROUTE_PROBES,
    // with and without ?edit=true, against Next's route sorting and route regexes.
    expect(AMBIGUOUS_ROUTE_PROBES).toEqual(
      expect.arrayContaining(['/forms/team/about', '/oauth/help', '/my-something']),
    );
    expect(verifyClientMessageRoutes(REPO_ROOT, CLIENT_MESSAGE_ROUTES)).toEqual([]);
  });
});

describe('resolveClientMessageScope', () => {
  it.each([
    ['/', 'public'],
    ['/posts/example?lang=ko', 'public'],
    ['/privacy/history/example?share=token', 'public'],
    ['/category/example', 'public'],
    ['/about/team', 'public'],
    ['/s/token', 'public'],
    ['/posts/example?edit=true', 'editor'],
    ['/works/example?edit=false&edit=true', 'editor'],
    ['/privacy/history/example?view=edit', 'editor'],
    ['/campaigns/example', 'editor'],
    ['/forms/example?edit=true&tab=builder', 'editor'],
    ['/forms/example', 'forms'],
    ['/forms/example/success', 'forms'],
    ['/login', 'auth'],
    ['/account/recover', 'auth'],
    ['/unsubscribe?token=x', 'auth'],
    ['/my', 'account'],
    ['/my/series/example?edit=true', 'account'],
    ['/admin/posts?edit=true', 'admin'],
    // Paths under a route-group prefix that no route pattern matches are CMS Pages served by
    // app/(general)/[...slug] (public shell, editable with ?edit=true).
    ['/forms/team/about', 'public'],
    ['/forms/team/about?edit=true', 'editor'],
    ['/oauth/help', 'public'],
    ['/oauth/help?edit=true', 'editor'],
    ['/oauth/authorize/consent', 'auth'],
    ['/account', 'public'],
    ['/admin/team/about', 'public'],
    ['/admin/users/example/notes', 'public'],
    ['/admin/users/example', 'admin'],
    ['/my-something', 'public'],
    ['/my/unknown/deep', 'public'],
    ['/campaigns', 'public'],
    ['/campaigns/example/analytics/extra?edit=true', 'editor'],
    ['/posts/example/extra', 'public'],
    // Only routes that render an editor for ?edit=true select the editor scope.
    ['/posts?edit=true', 'public'],
    ['/forms/example/success?edit=true', 'forms'],
    ['', null],
    ['//posts/example', null],
    ['https://example.com/posts', null],
  ] as const)('%s → %s', (path, scope) => {
    expect(resolveClientMessageScope(path)).toBe(scope);
  });
});
