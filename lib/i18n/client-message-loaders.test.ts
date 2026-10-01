import { describe, expect, it } from 'vitest';
import { getMessagesForLocale } from './messages';
import { loadClientMessagesForLocale } from './client-message-loaders';
import { SUPPORTED_LOCALES } from './locale';

describe('client message catalogue loaders', () => {
  it.each(SUPPORTED_LOCALES)('loads the matching full catalogue for %s', async (locale) => {
    await expect(loadClientMessagesForLocale(locale)).resolves.toBe(await getMessagesForLocale(locale));
  });
});
