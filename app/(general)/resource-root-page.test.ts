import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtistsRootPage from './artists/page';
import EventsRootPage from './events/page';
import LabelsRootPage from './labels/page';
import PostsRootPage from './posts/page';
import ReleasesRootPage from './releases/page';
import WorksRootPage from './works/page';
import FormsRootPage from '../forms/page';

const mocks = vi.hoisted(() => ({ render: vi.fn(), metadata: vi.fn() }));

vi.mock('./[...slug]/page', () => ({
  default: mocks.render,
  generateMetadata: mocks.metadata,
}));

const roots = [
  ['artists', ArtistsRootPage],
  ['events', EventsRootPage],
  ['forms', FormsRootPage],
  ['labels', LabelsRootPage],
  ['posts', PostsRootPage],
  ['releases', ReleasesRootPage],
  ['works', WorksRootPage],
] as const;

describe('plural resource root Page routes', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(roots)('delegates /%s to the Page catch-all controller', async (slug, RootPage) => {
    const searchParams = Promise.resolve({ edit: 'true' });
    RootPage({ searchParams });

    expect(mocks.render).toHaveBeenCalledOnce();
    const call = mocks.render.mock.calls[0]?.[0];
    await expect(call.params).resolves.toEqual({ slug: [slug] });
    expect(call.searchParams).toBe(searchParams);
  });
});
