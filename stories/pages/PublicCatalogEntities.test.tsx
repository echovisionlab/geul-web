// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PublicCatalogEntityPreview } from './PublicCatalogEntities.stories';
const preload = vi.hoisted(() => ({ pending: [] as Promise<unknown>[] }));
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<{ default: typeof import('next/dynamic').default }>(
    'next/dynamic',
  );
  return {
    default: (...args: Parameters<typeof dynamic>) => {
      const View = dynamic(...args) as ReturnType<typeof dynamic> & { render: { preload: () => Promise<unknown> } };
      preload.pending.push(View.render.preload());
      return View;
    },
  };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
beforeAll(async () => {
  await Promise.all(preload.pending);
});
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function render(entity: 'artist' | 'label' | 'release', fallback = false, sparse = false) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () =>
    root.render(
      <TestProviders>
        <PublicCatalogEntityPreview entity={entity} fallback={fallback} sparse={sparse} />
      </TestProviders>,
    ),
  );
}
describe('actual public catalog entity views', () => {
  it('exposes artist section structure and exact relationship destinations', async () => {
    await render('artist');
    expect(host.querySelectorAll('h1')).toHaveLength(1);
    expect(host.querySelector('h1')).toHaveTextContent('Mina Park');
    expect(host.querySelectorAll('[role="heading"][aria-level="2"]').length).toBeGreaterThanOrEqual(4);
    expect(host.querySelector('a[href="/labels/quiet-records"]')).toHaveTextContent('Quiet Records');
    expect(host.querySelector('a[href="/works/night-signals"]')).toHaveTextContent('Night Signals');
    expect(host.querySelector('.prose')).toHaveAttribute('lang', 'en');
  });
  it('retains label body, related artist and release reading order', async () => {
    await render('label');
    expect(host.querySelector('h1')).toHaveTextContent('Quiet Records');
    expect(host.querySelectorAll('[role="heading"][aria-level="2"]')).toHaveLength(3);
    expect(host.querySelector('a[href="/releases/night-signals"]')).toHaveAccessibleName('Night Signals');
    expect(host.querySelector('a[href="/artists/mina-park"]')).toHaveAccessibleName('Mina Park');
    expect(host.querySelector('.prose')).toHaveTextContent('Recording and sharing the sound of a place.');
  });
  it('marks the actual fallback language while keeping UI, track titles and durations unchanged', async () => {
    await render('release', true);
    expect(host.querySelector('.prose')).toHaveAttribute('lang', 'ko');
    expect(host.querySelector('.prose')).toHaveTextContent('공간의 소리를 기록하고 나누는 작업입니다.');
    expect(host.querySelector('[role="group"][aria-label="Harbor"]')).toHaveTextContent('2:05');
    expect(host.querySelector('[role="group"][aria-label="Quiet Room"]')).toHaveTextContent('2:05');
    expect(host.querySelector('a[href="/artists/mina-park"]')).toHaveTextContent('Mina Park');
  });
  it('keeps absent metadata and undelivered media out of the sparse release output', async () => {
    await render('release', false, true);
    expect(host.querySelector('h1')).toHaveTextContent('Night Signals');
    expect(host.querySelector('[aria-label="Harbor"]')).toBeNull();
    expect(host.querySelector('audio')).toBeNull();
    expect(host.textContent).toContain('TBA');
  });
});
