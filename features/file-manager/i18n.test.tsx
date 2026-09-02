// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '@/messages/en.json';
import jaMessages from '@/messages/ja.json';
import koMessages from '@/messages/ko.json';
import zhCNMessages from '@/messages/zh-CN.json';
import { useFileManagerI18n } from './i18n';

const localeCases = [
  { locale: 'en', messages: enMessages, root: 'Files', search: 'Search files and folders' },
  { locale: 'ko', messages: koMessages, root: '파일', search: '파일 및 폴더 검색' },
  { locale: 'ja', messages: jaMessages, root: 'ファイル', search: 'ファイルとフォルダーを検索' },
  { locale: 'zh-CN', messages: zhCNMessages, root: '文件', search: '搜索文件和文件夹' },
] as const;

function Probe() {
  const { labels, errorMessage } = useFileManagerI18n();
  return (
    <>
      <span data-root>{labels.root}</span>
      <span data-search>{labels.search}</span>
      <span data-failure>{errorMessage('load')}</span>
    </>
  );
}

describe('File Manager translations', () => {
  const containers: HTMLDivElement[] = [];

  afterEach(() => {
    for (const container of containers.splice(0)) {
      container.remove();
    }
  });

  it.each(localeCases)('uses the production labels for $locale', async ({ locale, messages, root, search }) => {
    const container = document.createElement('div');
    containers.push(container);
    document.body.appendChild(container);
    const reactRoot = createRoot(container);

    await act(async () => {
      reactRoot.render(
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Probe />
        </NextIntlClientProvider>,
      );
    });

    expect(container.querySelector('[data-root]')?.textContent).toBe(root);
    expect(container.querySelector('[data-search]')?.textContent).toBe(search);
    expect(container.querySelector('[data-failure]')?.textContent).not.toMatch(/^errors\./);

    await act(async () => reactRoot.unmount());
  });
});
