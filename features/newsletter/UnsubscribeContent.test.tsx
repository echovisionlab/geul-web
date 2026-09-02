// @vitest-environment jsdom

import { act } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { UnsubscribeContent } from './UnsubscribeContent';

const mocks = vi.hoisted(() => ({
  searchParams: new URLSearchParams(),
  unsubscribe: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.searchParams }));
vi.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => <div data-testid="page-loader" /> }));
vi.mock('@/lib/actions/newsletter', () => ({
  unsubscribeNewsletterAction: (...args: unknown[]) => mocks.unsubscribe(...args),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

async function render() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <MantineProvider>
          <UnsubscribeContent />
        </MantineProvider>
      </QueryClientProvider>,
    );
  });
}

beforeEach(() => {
  mocks.searchParams = new URLSearchParams();
  mocks.unsubscribe.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

describe('UnsubscribeContent', () => {
  it('does not render an email form without a signed token', async () => {
    await render();
    expect(container.querySelector('[data-unsubscribe-state="missing-token"]')).not.toBeNull();
    expect(container.querySelector('form')).toBeNull();
    expect(mocks.unsubscribe).not.toHaveBeenCalled();
  });

  it('submits the signed token and renders success', async () => {
    mocks.searchParams = new URLSearchParams('token=signed-token');
    mocks.unsubscribe.mockResolvedValue({ success: true, message: 'done' });
    await render();
    expect(mocks.unsubscribe).toHaveBeenCalledWith('signed-token');
    expect(container.querySelector('[data-unsubscribe-state="success"]')).not.toBeNull();
  });
});
