import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getProgramEventAdmin: vi.fn(),

  listArtistsAction: vi.fn(async () => []),
  listClientsAdmin: vi.fn(async () => ({ data: [] })),
  listLabelsAdmin: vi.fn(async () => ({ data: [] })),
  listProgramEventSeriesAdmin: vi.fn(async () => []),
  listProgramEventTypesAdmin: vi.fn(async () => []),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/program-event/ProgramEventEditor/ProgramEventEditor', () => ({
  ProgramEventEditor: ({
    eventId,
    initialStatus,
    allowedActions,
  }: {
    eventId: string;
    initialStatus: string;
    allowedActions: string[];
  }) => (
    <div>
      editor:{eventId}:{initialStatus}:{allowedActions.join(',')}
    </div>
  ),
}));
vi.mock('@/lib/actions/artist', () => ({ listArtistsAction: mocks.listArtistsAction }));
vi.mock('@/lib/queries/client', () => ({ listClientsAdmin: mocks.listClientsAdmin }));
vi.mock('@/lib/queries/label', () => ({ listLabelsAdmin: mocks.listLabelsAdmin }));
vi.mock('@/lib/queries/manifest', () => ({
  getManageSiteContext: vi.fn(async () => ({ canonicalOrigin: 'https://example.test', siteName: 'Geul' })),
}));
vi.mock('@/lib/queries/program-event', () => ({
  getProgramEventAdmin: mocks.getProgramEventAdmin,
  listProgramEventSeriesAdmin: mocks.listProgramEventSeriesAdmin,
  listProgramEventTypesAdmin: mocks.listProgramEventTypesAdmin,
}));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));

import { renderProgramEventEditRoute } from './ProgramEventEditRoute';

const EVENT_ID = '00000000-0000-4000-8000-000000000016';
const event = {
  id: EVENT_ID,
  title: 'Event',
  slug: 'event-slug',
  summary: null,
  status: 'archived',
  sourceLocale: 'en',
  typeId: 'type-1',
  seriesId: null,
  seriesOrder: null,
  startsAt: new Date('2026-08-06T00:00:00Z'),
  endsAt: null,
  timezone: 'Asia/Seoul',
  allDay: false,
  locationMode: 'online',
  mapPlaceId: null,
  posterUrl: null,
  media: [],
  ticketUrl: null,
  streamUrl: null,
  externalUrl: null,
  artists: [],
  labels: [],
  clients: [],
  credits: [],
};

describe('Program Event edit query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getProgramEventAdmin.mockResolvedValue(event);
  });

  it('redirects an anonymous request before looking up the Event', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(renderProgramEventEditRoute('private-event', { edit: 'true', lang: 'ko' })).rejects.toThrow(
      'redirect:/login?redirect=%2Fevents%2Fprivate-event%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.getProgramEventAdmin).not.toHaveBeenCalled();
  });

  it('returns the same not-found result for a non-Author and a missing Event', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Member', role: 'member' } });
    await expect(renderProgramEventEditRoute('hidden-event', { edit: 'true' })).rejects.toThrow('not-found');
    expect(mocks.getProgramEventAdmin).toHaveBeenCalledWith('hidden-event');

    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getProgramEventAdmin.mockResolvedValue(null);
    await expect(renderProgramEventEditRoute('missing-event', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority lookup', async () => {
    await expect(renderProgramEventEditRoute('event-slug', { edit: 'true', lang: 'ja' })).rejects.toThrow(
      `redirect:/events/${EVENT_ID}?edit=true&lang=ja`,
    );
    expect(mocks.getProgramEventAdmin).toHaveBeenCalledWith('event-slug');
  });

  it('mounts the normal editor for an archived Admin', async () => {
    const html = renderToStaticMarkup(await renderProgramEventEditRoute(EVENT_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${EVENT_ID}:archived:edit,delete,publish`);
  });

  it('mounts an editable draft for an authorized Admin ID', async () => {
    mocks.getProgramEventAdmin.mockResolvedValue({ ...event, status: 'draft' });

    const html = renderToStaticMarkup(await renderProgramEventEditRoute(EVENT_ID, { edit: 'true' }));

    expect(mocks.getProgramEventAdmin).toHaveBeenCalledWith(EVENT_ID);
    expect(html).toContain(`editor:${EVENT_ID}:draft:edit,delete,publish`);
  });

  it('mounts the collaboration editor for an archived Event Author in read-only mode', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-2', nickname: 'Author', role: 'author' } });

    const html = renderToStaticMarkup(await renderProgramEventEditRoute(EVENT_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${EVENT_ID}:archived:`);
    expect(html).not.toContain('edit,delete,publish');
    expect(mocks.listProgramEventTypesAdmin).not.toHaveBeenCalled();
    expect(mocks.listProgramEventSeriesAdmin).not.toHaveBeenCalled();
    expect(mocks.listArtistsAction).not.toHaveBeenCalled();
    expect(mocks.listLabelsAdmin).not.toHaveBeenCalled();
    expect(mocks.listClientsAdmin).not.toHaveBeenCalled();
  });
});
