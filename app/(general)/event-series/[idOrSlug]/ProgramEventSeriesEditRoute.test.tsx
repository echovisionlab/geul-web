import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getProgramEventSeriesAdmin: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/program-event/ProgramEventSeriesEditor/ProgramEventSeriesEditor', () => ({
  ProgramEventSeriesEditor: ({ seriesId, initialStatus }: { seriesId: string; initialStatus: string }) => (
    <div>
      editor:{seriesId}:{initialStatus}
    </div>
  ),
}));
vi.mock('@/lib/queries/manifest', () => ({
  getManageSiteContext: vi.fn(async () => ({ canonicalOrigin: 'https://example.test', siteName: 'Geul' })),
}));
vi.mock('@/lib/queries/program-event', () => ({
  getProgramEventSeriesAdmin: mocks.getProgramEventSeriesAdmin,
}));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));

import { renderProgramEventSeriesEditRoute } from './ProgramEventSeriesEditRoute';

const SERIES_ID = '00000000-0000-4000-8000-000000000017';
const series = {
  id: SERIES_ID,
  title: 'Event Series',
  slug: 'event-series',
  summary: null,
  description: null,
  status: 'draft',
  posterUrl: null,
};

describe('Program Event Series edit query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getProgramEventSeriesAdmin.mockResolvedValue(series);
  });

  it('redirects an anonymous request before looking up the Series', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(renderProgramEventSeriesEditRoute('private-series', { edit: 'true' })).rejects.toThrow(
      'redirect:/login?redirect=%2Fevent-series%2Fprivate-series%3Fedit%3Dtrue',
    );
    expect(mocks.getProgramEventSeriesAdmin).not.toHaveBeenCalled();
  });

  it('returns the same not-found result for a non-admin and a missing Series', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Member', role: 'member' } });
    await expect(renderProgramEventSeriesEditRoute('hidden-series', { edit: 'true' })).rejects.toThrow('not-found');
    expect(mocks.getProgramEventSeriesAdmin).not.toHaveBeenCalled();

    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getProgramEventSeriesAdmin.mockResolvedValue(null);
    await expect(renderProgramEventSeriesEditRoute('missing-series', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority lookup', async () => {
    await expect(renderProgramEventSeriesEditRoute('event-series', { edit: 'true', lang: 'ja' })).rejects.toThrow(
      `redirect:/event-series/${SERIES_ID}?edit=true&lang=ja`,
    );
    expect(mocks.getProgramEventSeriesAdmin).toHaveBeenCalledWith('event-series');
  });

  it('renders the editor for its immutable ID', async () => {
    const html = renderToStaticMarkup(await renderProgramEventSeriesEditRoute(SERIES_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${SERIES_ID}:draft`);
  });
});
