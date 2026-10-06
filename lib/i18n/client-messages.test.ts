import { describe, expect, it } from 'vitest';
import { isReducedCatalogueRoute, selectClientMessages } from './client-messages';
import { getMessagesForLocale } from './messages';
import { SUPPORTED_LOCALES } from './locale';

const NEW_PUBLIC_ROUTES = [
  '/posts',
  '/artists',
  '/labels',
  '/releases',
  '/events',
  '/labels/example',
  '/events/example',
  '/series/example',
  '/event-series/example',
  '/privacy/history',
  '/privacy/history/example',
  '/terms/history',
  '/terms/history/example',
];

// Namespaces used by public entity views, legal documents and the shared Page
// fallback (including public blocks), without editor-only namespaces.
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
  'privacyHistoryDetail',
  'termsHistoryDetail',
  'legalHistoryCommon',
  'legalHistoryDetailCommon',
  'legalPageCommon',
  'editorCommon',
  'mediaCommon',
  'publicTables',
  'works',
  'embeddedForm',
  'formAccess',
  'publicForm',
  'formValidation',
  'fileDownloadAccess',
  'map',
  'mapControls',
  'mermaid',
  'notFoundPage',
  'comments',
  'postView',
  'workView',
  'cookieConsentBanner',
] as const;

describe('anonymous public message catalogue', () => {
  it('removes private namespaces without mutating the complete server catalogue', async () => {
    const messages = await getMessagesForLocale('en');
    const selected = selectClientMessages(messages, { pathWithSearch: '/', hasSession: false });
    expect(selected.adminList).toBeUndefined();
    expect(selected.pageEditor).toBeUndefined();
    expect(messages.adminList).toBeDefined();
    expect(messages.pageEditor).toBeDefined();
    for (const namespace of [
      'common',
      'shell',
      'editorCommon',
      'fileDownloadAccess',
      'map',
      'mapControls',
      'publicForm',
      'formValidation',
      'contentLanguageMenu',
      'mermaid',
      'cookieConsentBanner',
      'tools',
      'programEventAdmin',
      'notFoundPage',
      'comments',
      'postView',
      'workView',
      'releasePage',
      'artistPage',
      'artistShareAccess',
      'releaseShareAccess',
      'workShareAccess',
      'pageShareAccess',
    ] as const) {
      expect(selected[namespace]).toBe(messages[namespace]);
    }
  });

  it.each([
    '/posts/a-public-post',
    '/works/69c28e39-1ed5-4f5d-8552-b01870171f99',
    '/releases/album-name?lang=ko&share=token',
    '/artists/%ED%95%9C%EA%B8%80?lang=en',
    '/posts/example?edit=false',
  ])('uses the reduced catalogue on audited detail %s', async (pathWithSearch) => {
    const messages = await getMessagesForLocale('en');
    expect(isReducedCatalogueRoute(pathWithSearch)).toBe(true);
    expect(selectClientMessages(messages, { pathWithSearch, hasSession: false }).postEditor).toBeUndefined();
    expect(selectClientMessages(messages, { pathWithSearch, hasSession: true })).toBe(messages);
  });

  it.each([
    '',
    '/custom-page',
    '/nested/page',
    '/pages/example',
    '/posts/',
    '/posts/example/edit',
    '/admin/posts/example',
    '/my/works/example',
    '/account/recover',
    '/ko/posts/example',
    '/en/works/example',
    '/posts/example?edit=true',
    '/labels/example?share=token',
    '/events/example?password=secret',
    '/terms/history/example?preview=true',
    '/event-series/example?edit=true',
    '/privacy/history/example?view=edit',
    '/terms/history/example?view=public&view=edit',
    '/labels/example?share=',
    '/events/example/extra',
    '/series/example/edit',
    '/privacy/history/example/extra',
    '/terms/history/',
    '/labels/%2Fhidden',
    '/events/%5Cprivate',
    '/events/%invalid',
    '/events/new',
    '/series',
    '/event-series',
    '/works/example?edit=false&edit=true',
    '//posts/example',
    'https://example.com/posts/example',
  ])('keeps the complete catalogue for unknown, protected or editing route %s', async (pathWithSearch) => {
    const messages = await getMessagesForLocale('en');
    expect(isReducedCatalogueRoute(pathWithSearch)).toBe(false);
    expect(selectClientMessages(messages, { pathWithSearch, hasSession: false })).toBe(messages);
  });

  it.each(['/tools/transcode', '/tools/youtube-audio', '/tools/hwp', '/tools/portadj'])(
    'keeps the complete catalogue for the generic Page fallback at former tool route %s',
    async (pathWithSearch) => {
      const messages = await getMessagesForLocale('en');
      expect(isReducedCatalogueRoute(pathWithSearch)).toBe(false);
      expect(selectClientMessages(messages, { pathWithSearch, hasSession: false })).toBe(messages);
      expect(selectClientMessages(messages, { pathWithSearch, hasSession: true })).toBe(messages);
    },
  );

  it.each(['/admin', '/login', '/my', '/custom-page', '/works?edit=true'])(
    'keeps the full catalogue on %s',
    async (pathWithSearch) => {
      const messages = await getMessagesForLocale('en');
      expect(selectClientMessages(messages, { pathWithSearch, hasSession: false })).toBe(messages);
    },
  );

  it.each(SUPPORTED_LOCALES)('covers newly audited public render namespaces in %s', async (locale) => {
    const messages = await getMessagesForLocale(locale);
    for (const pathWithSearch of NEW_PUBLIC_ROUTES) {
      expect(isReducedCatalogueRoute(`${pathWithSearch}?lang=ko&page=2`)).toBe(true);
      const selected = selectClientMessages(messages, { pathWithSearch, hasSession: false });
      for (const namespace of PUBLIC_VIEW_NAMESPACES) {
        expect(messages[namespace], `${pathWithSearch}: ${namespace}`).toBeDefined();
        expect(selected[namespace], `${pathWithSearch}: ${namespace}`).toBe(messages[namespace]);
      }
      expect(selected.pageEditor).toBeUndefined();
      expect(selected.legalEditorCommon).toBeUndefined();
      expect(selectClientMessages(messages, { pathWithSearch, hasSession: true })).toBe(messages);
    }
  });

  it('keeps all dialogs available to an authenticated public-page visitor', async () => {
    const messages = await getMessagesForLocale('en');
    expect(selectClientMessages(messages, { pathWithSearch: '/works', hasSession: true })).toBe(messages);
  });

  it.each(SUPPORTED_LOCALES)('preserves public media and shell messages for %s', async (locale) => {
    const messages = await getMessagesForLocale(locale);
    const selected = selectClientMessages(messages, { pathWithSearch: '/posts/example?lang=ko', hasSession: false });
    expect(selected.privacyPage).toEqual(messages.privacyPage);
    expect(selected.editorCommon).toEqual(messages.editorCommon);
    expect(selected.shell).toEqual(messages.shell);
    expect(Buffer.byteLength(JSON.stringify(selected))).toBeLessThan(Buffer.byteLength(JSON.stringify(messages)));
  });
});
