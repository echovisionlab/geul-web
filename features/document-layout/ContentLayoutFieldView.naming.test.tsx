// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { ContentLayoutFieldView } from './ui/ContentLayoutFieldView';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
it.each([
  ['en', enMessages],
  ['ko', koMessages],
] as const)('names all three %s groups with their existing visible headings', async (locale, messages) => {
  const labels = messages.contentLayout;
  const change = vi.fn();
  const value = { contentHeight: 'content', pageChrome: 'flow', footer: 'flow' } as const;
  await act(async () =>
    root.render(
      <TestProviders locale={locale} messages={messages}>
        <ContentLayoutFieldView
          value={value}
          onChange={change}
          labels={{ ...labels, pageChrome: labels.chrome, tableOfContents: 'Table of contents' }}
        />
      </TestProviders>,
    ),
  );
  const groups = host.querySelectorAll('[role="radiogroup"]');
  expect(groups).toHaveLength(3);
  [labels.contentHeight, labels.chrome, labels.footer].forEach((label, index) => {
    expect(groups[index]).toHaveAccessibleName(label);
    expect(host.textContent?.split(label)).toHaveLength(2);
  });
  const options = groups[2].querySelectorAll<HTMLInputElement>('input');
  await act(async () => options[1].click());
  expect(change).toHaveBeenCalledExactlyOnceWith({ ...value, footer: 'pinned' });
});
