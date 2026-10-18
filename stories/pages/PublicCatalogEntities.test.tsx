// @vitest-environment node
import { renderToReadableStream } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { PublicCatalogEntityPreview } from './PublicCatalogEntities.stories';
vi.mock('next/dynamic', async () => {
  const { default: dynamic } = await vi.importActual<typeof import('next/dist/shared/lib/app-dynamic.js')>(
    'next/dist/shared/lib/app-dynamic.js',
  );
  return { default: dynamic };
});
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/preview',
  useSearchParams: () => new URLSearchParams(),
}));
async function render(entity: 'artist' | 'label' | 'release', fallback = false, sparse = false) {
  const stream = await renderToReadableStream(
    <TestProviders>
      <PublicCatalogEntityPreview entity={entity} fallback={fallback} sparse={sparse} />
    </TestProviders>,
  );
  await stream.allReady;
  return new Response(stream).text();
}

describe('public catalog entity markup', () => {
  it('exposes artist section structure and exact relationship destinations', async () => {
    const markup = await render('artist');
    expect(markup.match(/<h1\b/g)).toHaveLength(1);
    expect(markup).toMatch(/<h1\b[^>]*>Mina Park<\/h1>/);
    expect(markup.match(/data-entity-detail-section=""[^>]*><div[^>]*><h2\b/g)?.length).toBeGreaterThanOrEqual(4);
    expect(markup).toMatch(
      /<a\b[^>]*href="\/labels\/quiet-records"[^>]*>(?:(?!<\/a>)[\s\S])*Quiet Records(?:(?!<\/a>)[\s\S])*<\/a>/,
    );
    expect(markup).toMatch(
      /<a\b[^>]*href="\/works\/night-signals"[^>]*>(?:(?!<\/a>)[\s\S])*Night Signals(?:(?!<\/a>)[\s\S])*<\/a>/,
    );
    expect(markup).toMatch(/<[^>]*class="[^"]*prose[^"]*"[^>]*lang="en"/);
  });
  it('marks the fallback language while retaining track titles and durations', async () => {
    const markup = await render('release', true);
    expect(markup).toMatch(/<[^>]*class="[^"]*prose[^"]*"[^>]*lang="ko"/);
    const prose = markup.match(/<div\b[^>]*class="[^"]*prose[^"]*"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    expect(prose).toContain('공간의 소리를 기록하고 나누는 작업입니다.');
    expect(markup).toMatch(/role="group"[^>]*aria-label="Harbor"[^>]*>(?:(?!role="group")[\s\S])*?2:05/);
    expect(markup).toMatch(/role="group"[^>]*aria-label="Quiet Room"[^>]*>(?:(?!role="group")[\s\S])*?2:05/);
    expect(markup).toMatch(
      /<a\b[^>]*href="\/artists\/mina-park"[^>]*>(?:(?!<\/a>)[\s\S])*Mina Park(?:(?!<\/a>)[\s\S])*<\/a>/,
    );
  });
  it('keeps absent metadata and undelivered media out of sparse release output', async () => {
    const markup = await render('release', false, true);
    expect(markup).toMatch(/<h1\b[^>]*>Night Signals<\/h1>/);
    expect(markup).not.toContain('aria-label="Harbor"');
    expect(markup).not.toMatch(/<audio\b/);
    expect(markup).toContain('TBA');
  });
});
