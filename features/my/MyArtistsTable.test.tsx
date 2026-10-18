import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MyArtistsDataTableProps } from '@/features/my/MyArtistsDataTable';
import { MANAGED_IMAGE_PRESET } from '@/lib/utils/managed-image-url';

const mocks = vi.hoisted(() => ({
  dataTableProps: null as MyArtistsDataTableProps | null,
  buildManagedImageUrl: vi.fn((src: string | null | undefined) => (src ? `managed:${src}` : null)),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

vi.mock('@/features/my/MyArtistsDataTable', () => ({
  MyArtistsDataTable: (props: MyArtistsDataTableProps) => {
    mocks.dataTableProps = props;
    return null;
  },
}));

vi.mock('@/lib/providers/LocaleProvider', () => ({
  useLocale: () => 'en-US',
}));

vi.mock('@/lib/utils/managed-image-url', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/utils/managed-image-url')>()),
  buildManagedImageUrl: mocks.buildManagedImageUrl,
}));

import { MyArtistsTable } from './MyArtistsTable';

const createdAt = new Date(2026, 6, 4, 12, 0, 0);
const initialData = {
  data: [
    {
      id: 'artist-published',
      name: 'Mina Park',
      slug: 'mina-park',
      imageUrl: '/media/mina.jpg',
      status: 'ARTIST_STATUS_PUBLISHED',
      createdAt,
    },
    {
      id: 'artist-unknown',
      name: 'Untitled Unit',
      slug: null,
      imageUrl: null,
      status: 'ARTIST_STATUS_REVIEW',
      createdAt: null,
    },
  ],
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

describe('MyArtistsTable controller', () => {
  it('preformats localized rows, managed image URLs, dates, statuses, and edit hrefs', () => {
    const listAction = vi.fn(() => new Promise<never>(() => undefined));
    renderToStaticMarkup(
      <QueryClientProvider client={new QueryClient()}>
        <MyArtistsTable initialData={initialData} listAction={listAction} />
      </QueryClientProvider>,
    );

    expect(mocks.dataTableProps).toMatchObject({
      labels: {
        title: 'common.entities.artists',
        image: 'common.labels.image',
        name: 'common.labels.name',
        status: 'common.labels.status',
        created: 'common.labels.created',
        empty: 'artists.empty',
        searchPlaceholder: 'artists.searchPlaceholder',
      },
      query: { page: 1, pageSize: 20 },
      loading: false,
      result: {
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        data: [
          {
            id: 'artist-published',
            name: 'Mina Park',
            slugLabel: '/mina-park',
            imageUrl: 'managed:/media/mina.jpg',
            href: '/artists/artist-published?edit=true',
            statusLabel: 'common.statuses.published',
            statusTone: 'positive',
            createdLabel: createdAt.toLocaleDateString('en-US'),
          },
          {
            id: 'artist-unknown',
            name: 'Untitled Unit',
            slugLabel: null,
            imageUrl: null,
            href: '/artists/artist-unknown?edit=true',
            statusLabel: 'ARTIST_STATUS_REVIEW',
            statusTone: 'neutral',
            createdLabel: '-',
          },
        ],
      },
    });
    expect(mocks.buildManagedImageUrl).toHaveBeenCalledWith('/media/mina.jpg', MANAGED_IMAGE_PRESET.AVATAR_SM);
  });
});
