import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  renderProgramEventEditRoute: vi.fn(),
  renderPageRouteFallback: vi.fn(),
  getProgramEventView: vi.fn(),
  getUserLocale: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => <div>loading</div> }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('@/lib/queries/program-event', () => ({ getProgramEventView: mocks.getProgramEventView }));
vi.mock('@/lib/translation/content-language', () => ({
  resolveContentRequestedLocale: (_locale: string, query: Record<string, unknown>) =>
    typeof query.lang === 'string' ? query.lang : 'en',
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: mocks.getUserLocale }));
vi.mock('./ProgramEventContent', () => ({
  ProgramEventContent: ({ idOrSlug, initialEvent }: { idOrSlug: string; initialEvent: { id: string } }) => (
    <div>
      public:{idOrSlug}:{initialEvent.id}
    </div>
  ),
}));
vi.mock('./ProgramEventEditRoute', () => ({
  generateProgramEventEditMetadata: vi.fn(),
  renderProgramEventEditRoute: mocks.renderProgramEventEditRoute,
}));
vi.mock('@/app/_shared/page-route-fallback', () => ({
  generatePageRouteFallbackMetadata: vi.fn(),
  renderPageRouteFallback: mocks.renderPageRouteFallback,
}));

import ProgramEventViewPage from './page';

function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  return ProgramEventViewPage({
    params: Promise.resolve({ idOrSlug: 'event-slug' }),
    searchParams: Promise.resolve(searchParams),
  });
}

describe('ProgramEventViewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getProgramEventView.mockResolvedValue({ id: 'event-id' });
    mocks.getUserLocale.mockResolvedValue('en');
    mocks.renderPageRouteFallback.mockReturnValue(<div>page-fallback</div>);
  });

  it('routes only literal edit=true to the authorized editor without a public lookup', async () => {
    mocks.renderProgramEventEditRoute.mockResolvedValue(<div>editor</div>);

    const html = renderToStaticMarkup(await renderPage({ edit: 'true', lang: 'ko' }));

    expect(html).toContain('editor');
    expect(mocks.renderProgramEventEditRoute).toHaveBeenCalledWith('event-slug', { edit: 'true', lang: 'ko' });
    expect(mocks.getUserLocale).not.toHaveBeenCalled();
    expect(mocks.getProgramEventView).not.toHaveBeenCalled();
  });

  it('keeps edit=false on the public Event view', async () => {
    const html = renderToStaticMarkup(await renderPage({ edit: 'false' }));

    expect(html).toContain('public:event-slug:event-id');
    expect(mocks.renderProgramEventEditRoute).not.toHaveBeenCalled();
    expect(mocks.getProgramEventView).toHaveBeenCalledOnce();
    expect(mocks.getProgramEventView).toHaveBeenCalledWith('event-slug', { requestedLocale: 'en' });
  });

  it('falls back to the nested Page route for a missing public Event', async () => {
    mocks.getProgramEventView.mockResolvedValue(null);

    const html = renderToStaticMarkup(await renderPage());

    expect(html).toContain('page-fallback');
    expect(mocks.renderPageRouteFallback).toHaveBeenCalledWith(['events', 'event-slug'], {});
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});
