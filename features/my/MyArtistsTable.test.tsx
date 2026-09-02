// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MyArtistsDataTableProps, MyArtistsDataTableQuery } from '@/features/my/MyArtistsDataTable';

interface ArtistsResult {
  data: Array<{
    id: string;
    name: string;
    slug: string | null;
    imageUrl: string | null;
    status: string;
    createdAt: Date | null;
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface QueryOptions {
  queryKey: unknown[];
  queryFn: () => Promise<ArtistsResult>;
  initialData: ArtistsResult;
}

const mocks = vi.hoisted(() => ({
  isLoading: false,
  queryData: null as ArtistsResult | null,
  queryOptions: null as QueryOptions | null,
  dataTableProps: null as MyArtistsDataTableProps | null,
  listMyArtistsAction: vi.fn(),
  buildManagedImageUrl: vi.fn((src: string | null) => (src ? `managed:${src}:avatar-sm` : null)),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: QueryOptions) => {
    mocks.queryOptions = options;
    return {
      data: mocks.queryData ?? options.initialData,
      isLoading: mocks.isLoading,
    };
  },
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

vi.mock('@/lib/actions/artist', () => ({
  listMyArtistsAction: mocks.listMyArtistsAction,
}));

vi.mock('@/lib/providers/LocaleProvider', () => ({
  useLocale: () => 'en-US',
}));

vi.mock('@/lib/utils/managed-image-url', () => ({
  buildManagedImageUrl: mocks.buildManagedImageUrl,
  MANAGED_IMAGE_PRESET: { AVATAR_SM: 'avatar-sm' },
}));

import { MyArtistsTable } from './MyArtistsTable';

let container: HTMLDivElement;
let root: Root;

const createdAt = new Date(2026, 6, 4, 12, 0, 0);
const initialData: ArtistsResult = {
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

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mocks.isLoading = false;
  mocks.queryData = initialData;
  mocks.queryOptions = null;
  mocks.dataTableProps = null;
  mocks.listMyArtistsAction.mockReset();
  mocks.buildManagedImageUrl.mockClear();
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderController() {
  act(() => {
    root.render(<MyArtistsTable initialData={initialData} />);
  });
}

function getDataTableProps() {
  expect(mocks.dataTableProps).not.toBeNull();
  return mocks.dataTableProps!;
}

function getQueryOptions() {
  expect(mocks.queryOptions).not.toBeNull();
  return mocks.queryOptions!;
}

describe('MyArtistsTable controller', () => {
  it('preformats localized rows, managed image URLs, dates, statuses, and edit hrefs', () => {
    renderController();

    expect(getDataTableProps()).toMatchObject({
      labels: {
        title: 'common.entities.artists',
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
            imageUrl: 'managed:/media/mina.jpg:avatar-sm',
            avatarFallback: 'M',
            href: '/artists/artist-published?edit=true',
            statusLabel: 'common.statuses.published',
            createdLabel: createdAt.toLocaleDateString('en-US'),
          },
          {
            id: 'artist-unknown',
            name: 'Untitled Unit',
            slugLabel: null,
            imageUrl: null,
            avatarFallback: 'U',
            href: '/artists/artist-unknown?edit=true',
            statusLabel: 'ARTIST_STATUS_REVIEW',
            createdLabel: '-',
          },
        ],
      },
    });
    expect(mocks.buildManagedImageUrl).toHaveBeenCalledTimes(2);
  });

  it('owns query state and maps table query changes to the list action input', async () => {
    mocks.listMyArtistsAction.mockResolvedValue(initialData);
    renderController();

    const nextQuery: MyArtistsDataTableQuery = {
      page: 3,
      pageSize: 10,
      search: 'mina',
      filterBy: 'OR',
      filters: [{ field: 'name', op: 'ilike', value: 'mina' }],
      sorts: [
        { field: 'created_at', direction: 'desc' },
        { field: 'name', direction: 'asc' },
      ],
    };

    act(() => getDataTableProps().onQueryChange(nextQuery));

    expect(getDataTableProps().query).toEqual(nextQuery);
    expect(getQueryOptions().queryKey).toEqual(['artists', 'my', nextQuery]);

    await getQueryOptions().queryFn();
    expect(mocks.listMyArtistsAction).toHaveBeenCalledWith({
      filter: nextQuery.filters,
      filterBy: 'OR',
      sort: [
        { field: 'created_at', order: 'desc' },
        { field: 'name', order: 'asc' },
      ],
      page: 3,
      pageSize: 10,
      search: 'mina',
    });
  });

  it('forwards the query loading state to the table controller', () => {
    mocks.isLoading = true;
    renderController();

    expect(getDataTableProps().loading).toBe(true);
  });
});
