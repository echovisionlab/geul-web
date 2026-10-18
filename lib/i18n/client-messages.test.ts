import { describe, expect, it } from 'vitest';
import { clientMessageCoverage, selectClientMessages } from './client-messages';
import { getMessagesForLocale } from './messages';

// Namespaces used by public entity views, legal documents and the shared Page fallback
// (including public blocks), without editor-only namespaces.
const PUBLIC_VIEW_NAMESPACES = [
  'common',
  'shell',
  'labelPage',
  'artistPage',
  'releasePage',
  'programEventAdmin',
  'contentLanguageMenu',
  'shareLinks',
  'privacyHistory',
  'termsHistory',
  'legalHistoryCommon',
  'legalHistoryDetailCommon',
  'legalPageCommon',
  'works',
  'embeddedForm',
  'formAccess',
  'publicForm',
  'formValidation',
  'map',
  'mermaid',
  'postView',
  'workView',
  'cookieConsentBanner',
  'artistShareAccess',
  'releaseShareAccess',
  'workShareAccess',
  'pageShareAccess',
] as const;

function getPath(tree: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown> | undefined)?.[key], tree);
}

const PUBLIC_PATHS = [
  '/',
  '/posts',
  '/posts/a-public-post?lang=ko&page=2',
  '/works/69c28e39-1ed5-4f5d-8552-b01870171f99',
  '/releases/album-name?share=token',
  '/artists/%ED%95%9C%EA%B8%80',
  '/labels/example',
  '/events/example',
  '/series/example',
  '/event-series/example',
  '/privacy/history/example?preview=true',
  '/terms/history',
  '/category/example',
  '/tag/example',
  '/custom-page',
  '/nested/page',
  '/tools/transcode',
  '/user/example',
];

describe('scoped client message catalogue', () => {
  it('selects without mutating the complete server catalogue', async () => {
    const messages = await getMessagesForLocale('en');
    const selected = selectClientMessages(messages, { pathWithSearch: '/' });
    expect(selected.adminList).toBeUndefined();
    expect(selected.pageEditor?.embed).toBe(messages.pageEditor.embed);
    expect(selected.pageEditor).not.toHaveProperty('blockEditor.sections');
    expect(messages.adminList).toBeDefined();
    expect(messages.pageEditor.blockEditor).toBeDefined();
    expect(selectClientMessages(messages, { pathWithSearch: '/' })).toBe(selected);
  });

  it.each(PUBLIC_PATHS)('uses the public scope on %s', async (pathWithSearch) => {
    const messages = await getMessagesForLocale('en');
    const selected = selectClientMessages(messages, { pathWithSearch });
    for (const namespace of PUBLIC_VIEW_NAMESPACES) {
      expect(selected[namespace], namespace).toBe(messages[namespace]);
    }
    expect(selected.postEditor).toBeUndefined();
    expect(selected.legalEditorCommon).toBeUndefined();
    expect(clientMessageCoverage(pathWithSearch)).toEqual(['public', 'forms']);
  });

  it.each([
    ['/posts/example?edit=true', 'postEditor'],
    ['/privacy/history/example?view=edit', 'legalEditorCommon'],
    ['/campaigns/example', 'campaignEditor'],
    ['/login', 'auth.login'],
    ['/my/security', 'security'],
    ['/admin/users', 'adminList'],
    ['/forms/example/password', 'formPasswordPage'],
  ] as const)('ships the route group messages on %s', async (pathWithSearch, path) => {
    const messages = await getMessagesForLocale('en');
    const selected = selectClientMessages(messages, { pathWithSearch });
    expect(getPath(selected, path)).toBe(getPath(messages, path));
  });

  it('keeps the complete catalogue for paths without a scope', async () => {
    const messages = await getMessagesForLocale('en');
    for (const pathWithSearch of ['', '//posts/example', 'https://example.com/posts/example']) {
      expect(selectClientMessages(messages, { pathWithSearch })).toBe(messages);
      expect(clientMessageCoverage(pathWithSearch)).toBe('all');
    }
  });

  it('reports which scopes each selection can serve without loading the complete catalogue', () => {
    expect(clientMessageCoverage('/posts/example?edit=true')).toEqual(expect.arrayContaining(['editor', 'public']));
    expect(clientMessageCoverage('/login')).toEqual(['auth']);
    expect(clientMessageCoverage('/forms/example')).toEqual(['forms']);
    expect(clientMessageCoverage('/admin')).not.toContain('public');
  });
});
