// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { LegalPagePreview } from './Legal.stories';
const local = vi.hoisted(() => ({ query: new URLSearchParams(), pending: [] as Promise<unknown>[] }));
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dynamic',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      const View = dynamic(...args) as ReturnType<typeof dynamic> & { render: { preload: () => Promise<unknown> } };
      local.pending.push(View.render.preload());
      return View;
    },
  };
});
vi.mock('next/navigation', () => ({
  useSearchParams: () => local.query,
  useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }),
}));
beforeAll(async () => {
  await Promise.all(local.pending);
});
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  local.query = new URLSearchParams();
});
async function render(state: 'fallback' | 'preview' | 'invalid-preview' | 'loading' | 'error') {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  if (state.includes('preview')) {
    local.query = new URLSearchParams('preview=preview-next&token=local-token');
  }
  await act(async () =>
    root.render(
      <TestProviders>
        <LegalPagePreview state={state} />
      </TestProviders>,
    ),
  );
}
describe('production legal page state fixtures', () => {
  it('marks the source fallback body independently of the current UI language', async () => {
    await render('fallback');
    expect(host.querySelector('.terms-content')).toHaveAttribute('lang', 'ko');
    expect(host.querySelector('.terms-content')).toHaveTextContent('이 문서는 원문 언어로 제공됩니다.');
    expect(host.querySelector('h1')).toHaveTextContent('Terms of Service');
  });
  it('offers the current policy after an invalid preview without presenting unpublished body', async () => {
    await render('invalid-preview');
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('a[href="/terms"]')).not.toBeNull();
    expect(host.querySelector('.terms-content')).toBeNull();
  });
  it('keeps pending and failed query states distinct from an empty policy', async () => {
    await render('loading');
    expect(host.querySelector('[data-legal-document]')).toBeNull();
    await act(async () =>
      root.render(
        <TestProviders>
          <LegalPagePreview state="error" />
        </TestProviders>,
      ),
    );
    expect(host.querySelector('[role="alert"]')).not.toBeNull();
    expect(host.querySelector('[data-legal-document]')).toBeNull();
  });
});
