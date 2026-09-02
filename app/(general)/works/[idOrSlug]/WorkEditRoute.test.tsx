import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getWorkForEdit: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('next-intl/server', () => ({ getTranslations: vi.fn() }));
vi.mock('@/features/work/WorkEditor/WorkEditor', () => ({
  WorkEditor: ({ workId, canEdit }: { workId: string; canEdit: boolean }) => (
    <div>
      editor:{workId}:{String(canEdit)}
    </div>
  ),
}));
vi.mock('@/lib/queries/manifest', () => ({
  getManageSiteContext: vi.fn(async () => ({ canonicalOrigin: 'https://example.test', siteName: 'Geul' })),
  getSettings: vi.fn(),
}));
vi.mock('@/lib/queries/work', () => ({ getWorkForEdit: mocks.getWorkForEdit }));
vi.mock('@/lib/utils/og', () => ({ buildStaticOgMetadata: vi.fn() }));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));

import { renderWorkEditRoute } from './WorkEditRoute';

const WORK_ID = '00000000-0000-4000-8000-000000000002';
const work = {
  id: WORK_ID,
  title: 'Work',
  slug: 'work-slug',
  type: 'portfolio',
  year: 2026,
  month: 8,
  untilYear: null,
  untilMonth: null,
  isPresent: false,
  summary: null,
  metadata: null,
  featured: false,
  status: 'draft',
  mapPlaceId: null,
  featuredImageUrl: null,
  ogImageUrl: null,
  clientIds: [],
  clientDetails: [],
};

describe('Work edit query route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', nickname: 'Admin', role: 'admin' } });
    mocks.getWorkForEdit.mockResolvedValue(work);
  });

  it('redirects an anonymous request to login before looking up the Work', async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(renderWorkEditRoute('private-work', { edit: 'true', lang: 'ko' })).rejects.toThrow(
      'redirect:/login?redirect=%2Fworks%2Fprivate-work%3Fedit%3Dtrue%26lang%3Dko',
    );
    expect(mocks.getWorkForEdit).not.toHaveBeenCalled();
  });

  it('does not distinguish an unauthorized Work from a missing Work', async () => {
    mocks.getWorkForEdit.mockResolvedValue(null);

    await expect(renderWorkEditRoute('hidden-work', { edit: 'true' })).rejects.toThrow('not-found');
  });

  it('mounts the collaboration editor for an archived Author in read-only mode', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-2', nickname: 'Author', role: 'author' } });
    mocks.getWorkForEdit.mockResolvedValue({ ...work, status: 'archived' });

    const html = renderToStaticMarkup(await renderWorkEditRoute(WORK_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${WORK_ID}:false`);
  });

  it('does not distinguish a non-archived Author Work from not-found', async () => {
    mocks.getSession.mockResolvedValue({ user: { id: 'member-2', nickname: 'Author', role: 'author' } });

    await expect(renderWorkEditRoute('private-work', { edit: 'true' })).rejects.toThrow('not-found');
    expect(mocks.getWorkForEdit).toHaveBeenCalledWith('private-work');
  });

  it('canonicalizes an authorized slug to the immutable ID after the authority lookup', async () => {
    await expect(renderWorkEditRoute('work-slug', { edit: 'true', lang: 'ja' })).rejects.toThrow(
      `redirect:/works/${WORK_ID}?edit=true&lang=ja`,
    );
    expect(mocks.getWorkForEdit).toHaveBeenCalledWith('work-slug');
  });

  it('renders the existing editor for its immutable ID', async () => {
    const html = renderToStaticMarkup(await renderWorkEditRoute(WORK_ID, { edit: 'true' }));

    expect(html).toContain(`editor:${WORK_ID}:true`);
    expect(mocks.getWorkForEdit).toHaveBeenCalledWith(WORK_ID);
  });
});
