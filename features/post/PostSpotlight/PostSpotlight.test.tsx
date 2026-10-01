import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ shortcut: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }));
vi.mock('@mantine/hooks', () => ({ useDebouncedValue: (value: string) => [value] }));
vi.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isLoading: false }) }));
vi.mock('@mantine/spotlight', () => ({
  Spotlight: Object.assign(
    ({ shortcut }: { shortcut: string }) => {
      mocks.shortcut(shortcut);
      return null;
    },
    { Action: () => null },
  ),
}));
vi.mock('@/lib/queries/post-browser', () => ({ searchPublishedPosts: vi.fn() }));

import { PostSpotlight } from './PostSpotlight';

describe('PostSpotlight keyboard shortcut', () => {
  beforeEach(() => mocks.shortcut.mockReset());

  it('registers the K shortcut shown by the site shell', () => {
    renderToStaticMarkup(<PostSpotlight />);

    expect(mocks.shortcut).toHaveBeenCalledWith('mod + K');
  });
});
