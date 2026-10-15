// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { SocialLinksEditor } from './SocialLinksEditor';

let cleanup = () => {};
afterEach(() => cleanup());

it('resolves production control names from locale without changing visible icon controls or saved URLs', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  cleanup = () => {
    act(() => root.unmount());
    host.remove();
  };
  const onChange = vi.fn();
  const value = { github: 'https://github.com/monome' };
  for (const [locale, messages] of [
    ['en', enMessages],
    ['ko', koMessages],
    ['en', enMessages],
  ] as const) {
    act(() =>
      root.render(
        <TestProviders locale={locale} messages={messages}>
          <SocialLinksEditor value={value} onChange={onChange} />
        </TestProviders>,
      ),
    );
    const handle = host.querySelector('[data-interaction="drag-handle"]')!;
    expect(handle).toHaveAccessibleName(`${messages.common.actions.move}: ${messages.socialLinks.label}`);
    expect(handle.textContent).toBe('');
    const url = host.querySelector<HTMLInputElement>('input:not([role="combobox"])')!;
    expect(url).toHaveAccessibleName(`GitHub: ${messages.socialLinks.valuePlaceholder}`);
    expect(url).toHaveValue(value.github);
  }
  expect(onChange).not.toHaveBeenCalled();
});
