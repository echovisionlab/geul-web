import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { AccountStatus } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import {
  USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
  USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
} from '@/lib/types/user/table-spec';
import { getUserProfileView, listAuthorOptions, listAuthors, listUserPublishedPostsTable } from './user';

const mocks = vi.hoisted(() => ({
  createMemberClient: vi.fn(),
  createPublicMemberClient: vi.fn(),
  createPublicPostClientWithAuth: vi.fn(),
  listPublishedPostsTable: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createPublicPostClientWithAuth: mocks.createPublicPostClientWithAuth,
  createMemberClient: mocks.createMemberClient,
  createPublicMemberClient: mocks.createPublicMemberClient,
}));

vi.mock('./post', () => ({
  listPublishedPostsTable: mocks.listPublishedPostsTable,
}));

describe('user queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the public profile client when there is no authenticated viewer', async () => {
    const createdAt = new Date('2026-02-03T00:00:00.000Z');
    mocks.createMemberClient.mockResolvedValue({
      getMember: vi.fn(),
    });
    mocks.createPublicMemberClient.mockReturnValue({
      getPublicMember: vi.fn().mockResolvedValue({
        member: {
          summary: {
            id: 'member-1',
            nickname: 'Public Member',
            avatarAsset: assetRefFixture('https://cdn.example.test/avatar.webp'),
            deleted: false,
          },
          bio: 'Hello world',
          socialLinks: {},
          createdAt: timestampFromDate(createdAt),
        },
      }),
    });

    const result = await getUserProfileView(null, null, 'member-1');

    expect(mocks.createPublicMemberClient).toHaveBeenCalled();
    expect(result).toEqual({
      id: 'member-1',
      name: 'Public Member',
      image: 'https://cdn.example.test/avatar.webp',
      bio: 'Hello world',
      social_links: {},
      role: null,
      status: 'active',
      banned: false,
      ban_reason: null,
      created_at: createdAt,
      deleted: false,
      isAdmin: false,
      isSelf: false,
    });
  });

  it('uses the admin client for privileged viewers', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    mocks.createMemberClient.mockResolvedValue({
      getMember: vi.fn().mockResolvedValue({
        member: {
          summary: {
            id: 'member-2',
            nickname: 'Managed Member',
            avatarAsset: assetRefFixture('https://cdn.example.test/avatar-2.webp'),
            deleted: false,
          },
          bio: 'Admin visible profile',
          socialLinks: {},
          createdAt: timestampFromDate(createdAt),
        },
        account: {
          canonicalEmail: { verified: false },
          role: AuthorizationRole.AUTHOR,
          status: AccountStatus.BANNED,
          banned: true,
          banDetails: { reason: 'spam' },
        },
      }),
    });

    const result = await getUserProfileView('member-admin', 'admin', 'member-2');

    expect(result).toEqual({
      id: 'member-2',
      name: 'Managed Member',
      image: 'https://cdn.example.test/avatar-2.webp',
      bio: 'Admin visible profile',
      social_links: {},
      email_verified: false,
      role: 'author',
      status: 'banned',
      banned: true,
      ban_reason: 'spam',
      created_at: createdAt,
      deleted: false,
      isAdmin: true,
      isSelf: false,
    });
  });

  it('maps complete author-list data from one ListAuthors call without profile fan-out', async () => {
    const get = vi.fn();
    const list = vi.fn().mockResolvedValue({
      authors: [
        {
          member: {
            id: 'author-1',
            nickname: 'Author',
            avatarAsset: assetRefFixture('https://cdn.example.test/author.webp'),
            deleted: false,
          },
          bio: 'Public bio',
          postCount: 3,
        },
      ],
    });
    mocks.createPublicMemberClient.mockReturnValue({ getPublicMember: get, listAuthors: list });

    await expect(listAuthors(4)).resolves.toEqual([
      {
        id: 'author-1',
        name: 'Author',
        image: 'https://cdn.example.test/author.webp',
        bio: 'Public bio',
        postCount: 3,
      },
    ]);

    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith({ limit: 4 });
    expect(get).not.toHaveBeenCalled();
  });

  it('derives author options from the same single ListAuthors response', async () => {
    const get = vi.fn();
    const list = vi.fn().mockResolvedValue({
      authors: [
        {
          member: { id: 'author-1', nickname: 'Author', deleted: false },
          bio: 'Public bio',
          postCount: 3,
        },
      ],
    });
    mocks.createPublicMemberClient.mockReturnValue({ getPublicMember: get, listAuthors: list });

    await expect(listAuthorOptions()).resolves.toEqual([{ id: 'author-1', name: 'Author', image: null, postCount: 3 }]);

    expect(list).toHaveBeenCalledOnce();
    expect(list).toHaveBeenCalledWith({ limit: 12 });
    expect(get).not.toHaveBeenCalled();
  });

  it('passes an ordered selected-author batch to ListAuthors', async () => {
    const list = vi.fn().mockResolvedValue({ authors: [] });
    mocks.createPublicMemberClient.mockReturnValue({ getPublicMember: vi.fn(), listAuthors: list });

    await expect(listAuthors(24, ['author-2', 'author-1'])).resolves.toEqual([]);

    expect(list).toHaveBeenCalledWith({ limit: 24, memberIds: ['author-2', 'author-1'] });
  });

  it('loads published posts with the resolved request locale', async () => {
    const { getUserPublishedPosts } = await import('./user');
    mocks.createPublicPostClientWithAuth.mockResolvedValue({
      list: vi.fn().mockResolvedValue({
        posts: [
          {
            id: 'post-1',
            title: '[ko] Localized title',
            slug: 'localized-title',
            summary: 'Localized summary',
            featuredImageDelivery: {
              thumbnail: assetRefFixture('https://cdn.example.test/featured.webp'),
            },
            publishedAt: timestampFromDate(new Date('2026-02-01T00:00:00.000Z')),
          },
        ],
      }),
    });

    const result = await getUserPublishedPosts('user-1', 'ko');

    expect(mocks.createPublicPostClientWithAuth).toHaveBeenCalledWith('ko');
    expect(result).toMatchObject([
      {
        id: 'post-1',
        title: '[ko] Localized title',
        slug: 'localized-title',
        summary: 'Localized summary',
        featured_image_url: 'https://cdn.example.test/featured.webp',
      },
    ]);
  });

  it('lists published posts table rows with user filter and default published sort', async () => {
    mocks.listPublishedPostsTable.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });

    const result = await listUserPublishedPostsTable(
      'user-1',
      {
        page: 1,
        pageSize: 10,
        search: 'draft',
      },
      'ko',
    );

    expect(mocks.listPublishedPostsTable).toHaveBeenCalledWith({
      query: {
        page: 1,
        pageSize: 10,
        search: 'draft',
        sorts: [{ field: 'published_at', direction: 'desc' }],
      },
      pageSize: 10,
      authorIds: ['user-1'],
      allowedFilterFields: USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
      allowedSortFields: USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
      rejectInvalidQuery: true,
      requestedLocale: 'ko',
    });
    expect(result).toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });
  });

  it('preserves explicit multi-sort queries when listing user published posts table rows', async () => {
    mocks.listPublishedPostsTable.mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 10,
      totalPages: 0,
    });

    await listUserPublishedPostsTable(
      'user-1',
      {
        page: 1,
        pageSize: 10,
        sorts: [
          { field: 'title', direction: 'asc' },
          { field: 'published_at', direction: 'desc' },
        ],
      },
      'en',
    );

    expect(mocks.listPublishedPostsTable).toHaveBeenLastCalledWith({
      query: {
        page: 1,
        pageSize: 10,
        sorts: [
          { field: 'title', direction: 'asc' },
          { field: 'published_at', direction: 'desc' },
        ],
      },
      pageSize: 10,
      authorIds: ['user-1'],
      allowedFilterFields: USER_PUBLISHED_POST_ALLOWED_FILTER_FIELDS,
      allowedSortFields: USER_PUBLISHED_POST_ALLOWED_SORT_FIELDS,
      rejectInvalidQuery: true,
      requestedLocale: 'en',
    });
  });
});
