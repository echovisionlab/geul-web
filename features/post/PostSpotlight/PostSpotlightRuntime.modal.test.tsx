// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('@/lib/queries/post-browser', () => ({ searchPublishedPosts: vi.fn() }));

import { PostSpotlightRuntime } from './PostSpotlightRuntime';

it('uses the Mantine modal input and Escape close with return focus', async () => {
  const host = document.createElement('div');
  const trigger = document.createElement('button');
  trigger.textContent = 'Search';
  document.body.append(trigger, host);
  trigger.focus();
  const root = createRoot(host);
  try {
    await act(async () =>
      root.render(
        <MantineProvider env="test">
          <PostSpotlightRuntime openRequest={1} />
        </MantineProvider>,
      ),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
    const input = document.querySelector<HTMLInputElement>('input[placeholder="searchPosts"]');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    await act(async () => input?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 250)));
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  } finally {
    await act(async () => root.unmount());
    host.remove();
    trigger.remove();
  }
});
