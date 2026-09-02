import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code, ConnectError } from '@connectrpc/connect';
import { FilterOp, SortOrder } from '@echovisionlab/geul-proto/common/common_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { AccountEmailSourceType, AccountStatus } from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assetRefFixture } from '@/tests/helpers/asset-ref';
import * as actions from './user';

const mocks = vi.hoisted(() => ({
  createAccountClient: vi.fn(),
  createMemberClient: vi.fn(),
  listAuthorOptions: vi.fn(),
  listAuthors: vi.fn(),
  loggerError: vi.fn(),
  revalidatePath: vi.fn(),
}));

const memberClient = vi.hoisted(() => ({
  deleteMemberAvatar: vi.fn(),
  deleteMyAvatar: vi.fn(),
  getMember: vi.fn(),
  listMembersAdmin: vi.fn(),
  setMemberAvatar: vi.fn(),
  setMemberTags: vi.fn(),
  setMyAvatar: vi.fn(),
  updateMemberProfile: vi.fn(),
  updateMyProfile: vi.fn(),
}));

const accountClient = vi.hoisted(() => ({
  banAccount: vi.fn(),
  deleteAccount: vi.fn(),
  removeAccountSsoProvider: vi.fn(),
  setAccountCanonicalEmail: vi.fn(),
  setAccountRole: vi.fn(),
  unbanAccount: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/api/server-client', () => ({
  createAccountClient: mocks.createAccountClient,
  createMemberClient: mocks.createMemberClient,
}));

vi.mock('@/lib/queries/user', () => ({
  listAuthorOptions: mocks.listAuthorOptions,
  listAuthors: mocks.listAuthors,
}));

vi.mock('@/lib/utils/logger', () => ({
  createLogger: () => ({ error: mocks.loggerError }),
}));

const memberSummary = (id: string, nickname: string, avatarUrl?: string) => ({
  id,
  nickname,
  avatarAsset: avatarUrl ? assetRefFixture(avatarUrl) : undefined,
  deleted: false,
});

describe('admin Member and profile actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMemberClient.mockResolvedValue(memberClient);
    mocks.createAccountClient.mockResolvedValue(accountClient);
    mocks.listAuthorOptions.mockResolvedValue([{ id: 'member-1', name: 'Author', image: null, postCount: 3 }]);
    mocks.listAuthors.mockResolvedValue([
      { id: 'member-1', name: 'Author', image: null, bio: 'Public bio', postCount: 3 },
    ]);

    memberClient.listMembersAdmin.mockResolvedValue({
      members: [
        {
          onboarded: false,
          member: {
            summary: memberSummary('member-1', 'Member'),
            createdAt: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
          },
          account: {
            canonicalEmail: { email: 'member@example.com', verified: true },
            role: AuthorizationRole.ADMIN,
            banned: false,
            status: AccountStatus.ACTIVE,
          },
          newsletterSubscription: {
            subscribed: true,
            subscribedAt: timestampFromDate(new Date('2026-01-03T00:00:00Z')),
          },
        },
      ],
      pagination: { total: 1 },
    });
    memberClient.getMember.mockResolvedValue({
      onboarded: false,
      tagIds: ['tag-1'],
      member: {
        summary: memberSummary('member-1', 'Member'),
        bio: 'Bio',
        website: 'https://member.example',
        socialLinks: { github: 'member' },
        createdAt: timestampFromDate(new Date('2026-01-01T00:00:00Z')),
      },
      account: {
        canonicalEmail: { email: 'member@example.com', verified: true },
        role: AuthorizationRole.AUTHOR,
        banned: true,
        status: AccountStatus.BANNED,
        banDetails: {
          metadataBanned: true,
          identityState: 'inactive',
          inactiveState: true,
          reason: 'spam',
        },
      },
      accountDetails: {
        providers: [{ provider: 'github', identifier: 'gh-1' }],
        emailCandidates: [
          {
            email: 'member@example.com',
            normalizedEmail: 'member@example.com',
            current: true,
            identityVerified: true,
            effectiveTrusted: true,
            usableForDelivery: true,
            sources: [
              { sourceType: AccountEmailSourceType.IDENTITY_CURRENT },
              {
                sourceType: AccountEmailSourceType.OIDC_PROVIDER,
                provider: 'github',
                providerSubject: 'gh-1',
              },
            ],
          },
        ],
      },
      newsletterSubscription: {
        subscribed: true,
        subscribedAt: timestampFromDate(new Date('2026-01-03T00:00:00Z')),
      },
    });

    memberClient.updateMyProfile.mockResolvedValue({ member: memberSummary('member-1', 'Me') });
    memberClient.setMyAvatar.mockResolvedValue({
      member: memberSummary('member-1', 'Me', 'https://cdn.example/me.webp'),
    });
    memberClient.setMemberAvatar.mockResolvedValue({
      member: memberSummary('member-2', 'Other', 'https://cdn.example/member.webp'),
    });
    memberClient.deleteMyAvatar.mockResolvedValue({ member: memberSummary('member-1', 'Me') });
  });

  it('maps admin list and detail projections without a secondary Account lookup', async () => {
    await expect(
      actions.listUsersAdminAction({
        page: 2,
        pageSize: 5,
        search: 'member',
        sort: [{ field: 'email', order: 'asc' }],
      }),
    ).resolves.toMatchObject({
      data: [
        {
          id: 'member-1',
          role: 'admin',
          status: 'active',
          onboarded: false,
          newsletter_subscribed: true,
          newsletter_subscribed_at: new Date('2026-01-03T00:00:00Z'),
        },
      ],
      total: 1,
      page: 2,
      pageSize: 5,
    });

    await expect(actions.getUserAdminAction('member-1')).resolves.toMatchObject({
      id: 'member-1',
      tag_ids: ['tag-1'],
      role: 'author',
      status: 'banned',
      onboarded: false,
      newsletter_subscribed: true,
      auth_details: {
        providers: [{ provider: 'github', identifier: 'gh-1' }],
        email_candidates: [
          expect.objectContaining({
            sources: [
              expect.objectContaining({ source_type: 'kratos_current' }),
              expect.objectContaining({ source_type: 'oidc_provider', provider: 'github' }),
            ],
          }),
        ],
      },
      ban_details: expect.objectContaining({ metadata_banned: true }),
    });

    expect(memberClient.listMembersAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        pagination: expect.objectContaining({ limit: 5, offset: 5 }),
      }),
    );
    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });

  it('treats omitted detail-only accountDetails as a valid list projection', async () => {
    const result = await actions.listUsersAdminAction({});

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).not.toHaveProperty('auth_details');
    expect(mocks.createAccountClient).not.toHaveBeenCalled();
  });

  it('forwards the supported admin Member filters and sort without dropping Identity-owned state', async () => {
    await actions.listUsersAdminAction({
      filter: [
        { field: 'nickname', op: 'ilike', value: 'member' },
        { field: 'role', op: 'in', value: ['admin', 'author'] },
        { field: 'status', op: 'eq', value: 'active' },
        { field: 'newsletter_subscribed', value: true },
        { field: 'created_at', op: 'gte', value: '2026-01-01' },
      ],
      sort: [{ field: 'newsletter_subscribed', order: 'desc' }],
    });

    expect(memberClient.listMembersAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: [
          expect.objectContaining({ field: 'nickname', op: FilterOp.ILIKE, value: 'member' }),
          expect.objectContaining({ field: 'role', op: FilterOp.IN, values: ['admin', 'author'] }),
          expect.objectContaining({ field: 'status', op: FilterOp.EQ, value: 'active' }),
          expect.objectContaining({
            field: 'newsletter_subscribed',
            op: FilterOp.EQ,
            value: 'true',
          }),
          expect.objectContaining({ field: 'created_at', op: FilterOp.GTE, value: '2026-01-01' }),
        ],
        sorts: [
          expect.objectContaining({
            field: 'newsletter_subscribed',
            order: SortOrder.DESC,
          }),
        ],
      }),
    );
  });

  it('routes profile/avatar mutations to Member and auth lifecycle mutations to Account', async () => {
    await expect(
      actions.updateUserAction('member-1', {
        nickname: 'Updated',
        bio: null,
        website: 'https://updated.example',
        social_links: null,
        role: 'admin',
        tag_ids: ['tag-1'],
      }),
    ).resolves.toEqual({ success: true });
    await expect(actions.banUserAction('member-1', 'spam', 60)).resolves.toEqual({ success: true });
    await expect(actions.unbanUserAction('member-1')).resolves.toEqual({ success: true });
    await expect(actions.setUserCanonicalEmailAction('member-1', 'main@example.com')).resolves.toEqual({
      success: true,
    });
    await expect(actions.removeUserSsoProviderAction('member-1', 'github', 'gh-1')).resolves.toEqual({
      success: true,
    });
    await expect(actions.deleteUserAction('member-1')).resolves.toEqual({ success: true });
    await expect(actions.updateProfileAction({ nickname: 'Me', social_links: { x: 'me' } })).resolves.toEqual({
      member: { id: 'member-1', nickname: 'Me', avatarUrl: null, deleted: false },
    });
    await expect(actions.setAvatarAction('file-1')).resolves.toEqual({
      member: {
        id: 'member-1',
        nickname: 'Me',
        avatarUrl: 'https://cdn.example/me.webp',
        deleted: false,
      },
    });
    await expect(actions.setAvatarForMemberAction('member-2', 'file-2')).resolves.toEqual({
      url: 'https://cdn.example/member.webp',
    });
    await expect(actions.deleteAvatarAction()).resolves.toEqual({
      member: { id: 'member-1', nickname: 'Me', avatarUrl: null, deleted: false },
    });
    await expect(actions.deleteAvatarForMemberAction('member-2')).resolves.toEqual({ success: true });

    expect(accountClient.setAccountRole).toHaveBeenCalledWith({
      memberId: 'member-1',
      role: AuthorizationRole.ADMIN,
    });
    expect(accountClient.banAccount).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-1', reason: 'spam' }),
    );
    expect(memberClient.updateMemberProfile).toHaveBeenCalledWith(
      expect.objectContaining({ memberId: 'member-1', nickname: 'Updated' }),
    );
    expect(memberClient.setMemberTags).toHaveBeenCalledWith({
      memberId: 'member-1',
      tagIds: ['tag-1'],
    });
  });

  it('keeps omitted profile fields out of partial Member updates and preserves explicit clearing', async () => {
    await expect(actions.updateUserAction('member-1', { nickname: 'Name only' })).resolves.toEqual({ success: true });
    expect(memberClient.updateMemberProfile).toHaveBeenLastCalledWith({
      memberId: 'member-1',
      nickname: 'Name only',
    });

    await expect(
      actions.updateUserAction('member-1', {
        bio: null,
        website: null,
        social_links: null,
      }),
    ).resolves.toEqual({ success: true });
    expect(memberClient.updateMemberProfile).toHaveBeenLastCalledWith({
      memberId: 'member-1',
      bio: '',
      website: '',
      socialLinks: {},
    });

    await expect(actions.updateUserAction('member-1', { tag_ids: [] })).resolves.toEqual({ success: true });
    expect(memberClient.setMemberTags).toHaveBeenLastCalledWith({
      memberId: 'member-1',
      tagIds: [],
    });

    await expect(actions.updateProfileAction({ nickname: 'Self name only' })).resolves.toEqual({
      member: { id: 'member-1', nickname: 'Me', avatarUrl: null, deleted: false },
    });
    expect(memberClient.updateMyProfile).toHaveBeenLastCalledWith({ nickname: 'Self name only' });
  });

  it('keeps client-callable author actions on the single ListAuthors path', async () => {
    await expect(actions.listAuthorOptionsAction()).resolves.toEqual([
      { id: 'member-1', name: 'Author', image: null, postCount: 3 },
    ]);
    await expect(actions.listAuthorsAction(4)).resolves.toEqual([
      { id: 'member-1', name: 'Author', image: null, bio: 'Public bio', postCount: 3 },
    ]);
    await expect(actions.listAuthorsAction(24, ['member-2', 'member-1'])).resolves.toEqual([
      { id: 'member-1', name: 'Author', image: null, bio: 'Public bio', postCount: 3 },
    ]);

    expect(mocks.listAuthorOptions).toHaveBeenCalledWith(12);
    expect(mocks.listAuthors).toHaveBeenCalledWith(4);
    expect(mocks.listAuthors).toHaveBeenCalledWith(24, ['member-2', 'member-1']);
  });

  it('returns empty/null results on RPC failures and stable mutation errors', async () => {
    memberClient.listMembersAdmin.mockRejectedValueOnce(new ConnectError('unavailable', Code.Unavailable));
    await expect(actions.listUsersAdminAction({})).resolves.toEqual({
      data: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });

    memberClient.getMember.mockRejectedValueOnce(new ConnectError('missing', Code.NotFound));
    await expect(actions.getUserAdminAction('missing')).resolves.toBeNull();

    accountClient.deleteAccount.mockRejectedValueOnce(new ConnectError('denied', Code.PermissionDenied));
    await expect(actions.deleteUserAction('member-1')).resolves.toEqual({
      error: '[permission_denied] denied',
    });
  });
});
