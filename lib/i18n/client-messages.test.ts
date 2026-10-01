import { describe, expect, it } from 'vitest';
import { selectClientMessages } from './client-messages';
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
    ] as const) {
      expect(selected[namespace]).toBe(messages[namespace]);
    }
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
    const selected = selectClientMessages(messages, { pathWithSearch: '/privacy?lang=ko', hasSession: false });
    expect(selected.privacyPage).toEqual(messages.privacyPage);
    expect(selected.editorCommon).toEqual(messages.editorCommon);
    expect(selected.shell).toEqual(messages.shell);
    expect(Buffer.byteLength(JSON.stringify(selected))).toBeLessThan(Buffer.byteLength(JSON.stringify(messages)));
  });
});
