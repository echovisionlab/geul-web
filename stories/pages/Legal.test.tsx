// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
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
afterEach(() => {
  local.query = new URLSearchParams();
});
function renderState(state: 'fallback' | 'preview' | 'invalid-preview' | 'loading' | 'error') {
  if (state.includes('preview')) {
    local.query = new URLSearchParams('preview=preview-next&token=local-token');
  }
  return render(<LegalPagePreview state={state} />);
}
describe('production legal page state fixtures', () => {
  it('marks the source fallback body independently of the current UI language', async () => {
    renderState('fallback');
    expect(await screen.findByText('이 문서는 원문 언어로 제공됩니다.')).toBeVisible();
    expect(screen.getByRole('heading', { level: 1, name: '이용약관' })).toHaveAttribute('lang', 'ko');
  });
  it('renders the actual scheduled preview branch from the locally scoped preview key', async () => {
    renderState('preview');
    expect(await screen.findByText('This policy explains the current conditions and effective period.')).toBeVisible();
    expect(screen.getByText('Version 4')).toBeVisible();
  });
  it('offers the current policy after an invalid preview without presenting unpublished body', async () => {
    renderState('invalid-preview');
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.getByRole('link', { name: 'View current terms' })).toHaveAttribute('href', '/terms');
    expect(screen.queryByText('This policy explains the current conditions and effective period.')).toBeNull();
  });
  it('keeps pending and failed query states distinct from an empty policy', async () => {
    const view = renderState('loading');
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    view.rerender(<LegalPagePreview state="error" />);
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
