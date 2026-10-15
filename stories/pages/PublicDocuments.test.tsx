// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PublicDocumentPagePreview } from './PublicDocuments.stories';
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
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
}));
vi.mock('@/lib/actions/post', () => ({ getPostMarkdownAction: vi.fn() }));
beforeAll(async () => {
  await Promise.all(preload.pending);
});
let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
async function render(view: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root.render(<TestProviders>{view}</TestProviders>);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
}
describe('actual public document page surfaces', () => {
  it('renders the exact shared CMS owner with the explicit alias title and content', async () => {
    await render(<PublicDocumentPagePreview domain="page" pagePath="/artists" />);
    expect(host.textContent).toContain('/artists');
    expect(host.textContent).toContain('A small room, a quiet signal, and time to listen.');
    expect(host.querySelector('[data-content-layout]')).not.toBeNull();
  });
  it('renders the production post header, generated typed rich text and local comment result', async () => {
    await render(<PublicDocumentPagePreview />);
    expect(host.querySelector('[data-content-layout]')).not.toBeNull();
    expect(host.textContent).toContain('A small room, a quiet signal, and time to listen.');
    expect(host.querySelector('a[href="/posts/first-day"]')).not.toBeNull();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });
    expect(host.textContent).toContain('Comments');
  });
  it('renders the actual generated custom page section with pinned document chrome', async () => {
    await render(<PublicDocumentPagePreview domain="page" state="pinned" />);
    expect(host.querySelector('[data-content-layout]')?.getAttribute('data-page-chrome')).toBe('pinned');
    expect(host.querySelector('[data-section-type="rich-text"]')).not.toBeNull();
    expect(host.textContent).toContain('Quiet Studio');
    expect(host.textContent).toContain('A small room, a quiet signal, and time to listen.');
  });
  it('uses actual hero image and empty content states', async () => {
    await render(<PublicDocumentPagePreview state="hero" />);
    expect(host.querySelector('img[src="/storybook/media/video-poster.jpg"]')).not.toBeNull();
  });
});
