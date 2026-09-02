// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EmojiPicker } from './EmojiPicker';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EmojiPicker', () => {
  it('renders controlled Core controls and reports query and item choices without editor knowledge', () => {
    const onQueryChange = vi.fn();
    const onSelect = vi.fn();
    act(() => {
      root.render(
        <MantineProvider env="test">
          <EmojiPicker
            opened
            title="Emoji"
            searchPlaceholder="Search Emoji"
            noResults="No results"
            closeLabel="Close"
            query="smile"
            items={[{ id: 'smile', value: '😄', label: ':smile:' }]}
            onQueryChange={onQueryChange}
            onClose={() => undefined}
            onSelect={onSelect}
          />
        </MantineProvider>,
      );
    });

    const input = document.body.querySelector<HTMLInputElement>('[aria-label="Search Emoji"]');
    expect(input?.value).toBe('smile');
    const option = document.body.querySelector<HTMLButtonElement>('[role="option"][aria-label=":smile:"]');
    expect(option?.textContent).toBe('😄');
    expect(option?.dataset.size).toBe('md');

    act(() => option?.click());
    expect(onSelect).toHaveBeenCalledWith({ id: 'smile', value: '😄', label: ':smile:' });

    act(() => {
      if (!input) {
        return;
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'heart');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(onQueryChange).toHaveBeenCalledWith('heart');
  });
});
