import { describe, expect, it } from 'vitest';
import { isReducedCatalogueRoute, selectClientMessages } from './client-messages';
import { getMessagesForLocale } from './messages';
import { SUPPORTED_LOCALES } from './locale';

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
    '/posts',
    '/artists',
    '/releases',
    '/posts/',
    '/posts/example/edit',
    '/admin/posts/example',
    '/my/works/example',
    '/account/recover',
    '/ko/posts/example',
    '/en/works/example',
    '/posts/example?edit=true',
    '/works/example?edit=false&edit=true',
    '//posts/example',
    'https://example.com/posts/example',
  ])('keeps the complete catalogue for unknown, protected or editing route %s', async (pathWithSearch) => {
    const messages = await getMessagesForLocale('en');
    expect(isReducedCatalogueRoute(pathWithSearch)).toBe(false);
    expect(selectClientMessages(messages, { pathWithSearch, hasSession: false })).toBe(messages);
  });

  it.each(['/admin', '/login', '/my', '/privacy/history', '/custom-page', '/works?edit=true'])(
    'keeps the full catalogue on %s',
    async (pathWithSearch) => {
      const messages = await getMessagesForLocale('en');
      expect(selectClientMessages(messages, { pathWithSearch, hasSession: false })).toBe(messages);
    },
  );

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
