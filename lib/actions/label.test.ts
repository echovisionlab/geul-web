import { create } from '@bufbuild/protobuf';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { FilterOp, FilterSpecSchema, SortSpecSchema } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicLabelClientWithAuth } from '@/lib/api/server-client';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import { getLabelsForBlockByIdsAction, listLabelsForBlockAction } from './label';

const listMock = vi.fn();

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createLabelClient: vi.fn(),
  createPublicLabelClientWithAuth: vi.fn(),
}));

vi.mock('@/lib/i18n/default-entity-name.server', () => ({
  getLocalizedNewEntityName: vi.fn(async () => 'New Label'),
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
  }),
}));

beforeEach(() => {
  listMock.mockReset();
  vi.mocked(createPublicLabelClientWithAuth).mockReset();
  vi.mocked(createPublicLabelClientWithAuth).mockResolvedValue({
    list: listMock,
  } as unknown as Awaited<ReturnType<typeof createPublicLabelClientWithAuth>>);
});

describe('listLabelsForBlockAction', () => {
  it('maps public label summaries for page block rendering', async () => {
    const publishedAt = new Date('2026-05-01T13:00:00.000Z');
    listMock.mockResolvedValue({
      labels: [
        {
          id: 'label-1',
          name: 'Label One',
          slug: 'label-one',
          imageLightAsset: assetRefFixture('https://cdn.example/light.png'),
          imageDarkAsset: assetRefFixture('https://cdn.example/dark.png'),
          countryCode: 'KR',
          publishedAt: timestampFromDate(publishedAt),
        },
        {
          id: 'label-2',
          name: 'Label Two',
          slug: undefined,
          imageLightAsset: assetRefFixture('https://cdn.example/fallback.png'),
          countryCode: undefined,
          publishedAt: undefined,
        },
        {
          id: 'label-3',
          name: 'Label Three',
          slug: undefined,
          countryCode: undefined,
          publishedAt: undefined,
        },
      ],
      pagination: { total: 7 },
    });

    await expect(
      listLabelsForBlockAction({
        sortBy: 'published_at',
        sortOrder: 'desc',
        limit: 3,
        offset: 6,
        requestedLocale: 'ko',
      }),
    ).resolves.toEqual({
      labels: [
        {
          id: 'label-1',
          name: 'Label One',
          slug: 'label-one',
          imageUrl: 'https://cdn.example/light.png',
          imageLightUrl: 'https://cdn.example/light.png',
          imageDarkUrl: 'https://cdn.example/dark.png',
          countryCode: 'KR',
          publishedAt,
        },
        {
          id: 'label-2',
          name: 'Label Two',
          slug: null,
          imageUrl: 'https://cdn.example/fallback.png',
          imageLightUrl: 'https://cdn.example/fallback.png',
          imageDarkUrl: null,
          countryCode: null,
          publishedAt: null,
        },
        {
          id: 'label-3',
          name: 'Label Three',
          slug: null,
          imageUrl: null,
          imageLightUrl: null,
          imageDarkUrl: null,
          countryCode: null,
          publishedAt: null,
        },
      ],
      pagination: { total: 7, limit: 3, offset: 6 },
    });

    expect(createPublicLabelClientWithAuth).toHaveBeenCalledWith('ko');
    expect(listMock).toHaveBeenCalledWith({
      pagination: { limit: 3, offset: 6 },
      sorts: [
        create(SortSpecSchema, {
          field: 'published_at',
          order: 2,
        }),
      ],
    });
  });

  it('uses default list controls and empty results when the public API omits optional fields', async () => {
    listMock.mockResolvedValue({});

    await expect(listLabelsForBlockAction({ requestedLocale: undefined })).resolves.toEqual({
      labels: [],
      pagination: { total: 0, limit: 12, offset: 0 },
    });

    expect(listMock).toHaveBeenCalledWith({
      pagination: { limit: 12, offset: 0 },
      sorts: [
        create(SortSpecSchema, {
          field: 'name',
          order: 1,
        }),
      ],
    });
  });

  it('returns an empty block result when listing labels fails', async () => {
    listMock.mockRejectedValue(new Error('backend unavailable'));

    await expect(listLabelsForBlockAction({ requestedLocale: null })).resolves.toEqual({
      labels: [],
      pagination: { total: 0, limit: 12, offset: 0 },
    });
  });
});

describe('getLabelsForBlockByIdsAction', () => {
  it('loads selected labels in one request and skips missing IDs', async () => {
    const publishedAt = new Date('2026-05-01T14:00:00.000Z');
    const labelOneID = '00000000-0000-4000-8000-000000000001';
    const labelTwoID = '00000000-0000-4000-8000-000000000002';
    const labelThreeID = '00000000-0000-4000-8000-000000000003';
    const missingID = '00000000-0000-4000-8000-000000000004';
    listMock.mockResolvedValue({
      labels: [
        {
          id: labelOneID,
          name: 'Label One',
          slug: 'label-one',
          imageLightAsset: assetRefFixture('https://cdn.example/logo.png'),
          imageDarkAsset: assetRefFixture('https://cdn.example/logo-dark.png'),
          countryCode: 'US',
          publishedAt: timestampFromDate(publishedAt),
          website: 'https://label.example',
        },
        {
          id: labelTwoID,
          name: 'Label Two',
          slug: undefined,
          imageLightAsset: assetRefFixture('https://cdn.example/logo-light.png'),
          countryCode: undefined,
          publishedAt: undefined,
          website: undefined,
        },
        {
          id: labelThreeID,
          name: 'Label Three',
          slug: undefined,
          countryCode: undefined,
          publishedAt: undefined,
          website: undefined,
        },
      ],
    });

    await expect(
      getLabelsForBlockByIdsAction({
        ids: [labelOneID, labelTwoID, labelThreeID, missingID],
        requestedLocale: 'ja',
      }),
    ).resolves.toEqual([
      {
        id: labelOneID,
        name: 'Label One',
        slug: 'label-one',
        imageUrl: 'https://cdn.example/logo.png',
        imageLightUrl: 'https://cdn.example/logo.png',
        imageDarkUrl: 'https://cdn.example/logo-dark.png',
        countryCode: 'US',
        publishedAt,
        website: 'https://label.example',
      },
      {
        id: labelTwoID,
        name: 'Label Two',
        slug: null,
        imageUrl: 'https://cdn.example/logo-light.png',
        imageLightUrl: 'https://cdn.example/logo-light.png',
        imageDarkUrl: null,
        countryCode: null,
        publishedAt: null,
        website: null,
      },
      {
        id: labelThreeID,
        name: 'Label Three',
        slug: null,
        imageUrl: null,
        imageLightUrl: null,
        imageDarkUrl: null,
        countryCode: null,
        publishedAt: null,
        website: null,
      },
    ]);

    expect(createPublicLabelClientWithAuth).toHaveBeenCalledWith('ja');
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith({
      pagination: { limit: 4 },
      filters: [
        create(FilterSpecSchema, {
          field: 'id',
          op: FilterOp.IN,
          values: [labelOneID, labelTwoID, labelThreeID, missingID],
        }),
      ],
    });
  });

  it('returns an empty selected label list when a non-not-found lookup fails', async () => {
    listMock.mockRejectedValue(new Error('unavailable'));

    await expect(getLabelsForBlockByIdsAction({ ids: ['label-one'], requestedLocale: undefined })).resolves.toEqual([]);
  });
});
