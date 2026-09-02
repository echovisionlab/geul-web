import { describe, expect, it } from 'vitest';
import {
  buildContentLanguageHref,
  CONTENT_LANGUAGE_QUERY_PARAM,
  readContentLocaleOverride,
  resolveContentRequestedLocale,
} from './content-language';

describe('content-language helpers', () => {
  it('reads locale overrides from scalar and array query params', () => {
    expect(readContentLocaleOverride({ [CONTENT_LANGUAGE_QUERY_PARAM]: 'ko' })).toBe('ko');
    expect(
      readContentLocaleOverride({
        [CONTENT_LANGUAGE_QUERY_PARAM]: ['pt-BR', 'en'],
      }),
    ).toBe('pt-BR');
    expect(readContentLocaleOverride({ [CONTENT_LANGUAGE_QUERY_PARAM]: 'ru' })).toBe('ru');
  });

  it('uses the exact content override, then the routed request locale, then the UI default', () => {
    expect(
      resolveContentRequestedLocale('en', {
        [CONTENT_LANGUAGE_QUERY_PARAM]: 'ja',
      }),
    ).toBe('ja');
    expect(resolveContentRequestedLocale('pt-PT', {})).toBe('pt-PT');
    expect(resolveContentRequestedLocale(null, {})).toBe('en');
  });

  it('builds content-language hrefs while preserving unrelated query params', () => {
    expect(
      buildContentLanguageHref(
        '/forms/contact',
        {
          foo: 'bar',
          list: ['one', 'two'],
          view: 'original',
          [CONTENT_LANGUAGE_QUERY_PARAM]: 'ko',
        },
        {
          requestedLocale: 'ja',
        },
      ),
    ).toBe('/forms/contact?foo=bar&list=one&list=two&lang=ja');
  });

  it('omits invalid requested locales and strips stale view params', () => {
    expect(
      buildContentLanguageHref(
        '/posts/post-1',
        {
          tab: 'settings',
          [CONTENT_LANGUAGE_QUERY_PARAM]: 'ko',
        },
        {
          requestedLocale: 'ru',
        },
      ),
    ).toBe('/posts/post-1?tab=settings&lang=ru');
  });
});
