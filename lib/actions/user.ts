'use server';

import { isConnectError } from '@/lib/api/connect-error';
import { revalidatePath } from 'next/cache';
import { create } from '@bufbuild/protobuf';
import { timestampDate, timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import {
  FilterOp,
  type FilterSpec,
  FilterSpecSchema,
  PaginationRequestSchema,
  SortOrder,
  SortSpecSchema,
} from '@echovisionlab/geul-proto/common/common_pb.ts';
import {
  AccountEmailSourceType,
  AccountStatus,
  type AccountAdminDetails,
  type AccountBanDetails as ProtoAccountBanDetails,
} from '@echovisionlab/geul-proto/secure/account_pb.ts';
import { AuthorizationRole } from '@echovisionlab/geul-proto/policy/access_pb.ts';
import { createAccountClient, createMemberClient } from '@/lib/api/server-client';
import { listAuthorOptions as queryListAuthorOptions, listAuthors as queryListAuthors } from '@/lib/queries/user';
import type { AdminUserBanDetails } from '@/lib/types/user/model';
import { createLogger } from '@/lib/utils/logger';
import { accountRoleToString, accountStatusToString } from '@/lib/types/user/proto';

const logger = createLogger('user-actions');

interface UserListInput {
  filter?: unknown;
  sort?: { field: string; order?: 'asc' | 'desc' }[];
  page?: number;
  pageSize?: number;
  search?: string;
}

const adminMemberFilterFields = new Set(['nickname', 'role', 'status', 'newsletter_subscribed', 'created_at']);

function adminMemberFilterOp(op: unknown): FilterOp | null {
  switch (op) {
    case undefined:
    case 'eq':
      return FilterOp.EQ;
    case 'ne':
      return FilterOp.NEQ;
    case 'gt':
      return FilterOp.GT;
    case 'gte':
      return FilterOp.GTE;
    case 'lt':
      return FilterOp.LT;
    case 'lte':
      return FilterOp.LTE;
    case 'like':
      return FilterOp.LIKE;
    case 'ilike':
      return FilterOp.ILIKE;
    case 'in':
      return FilterOp.IN;
    default:
      return null;
  }
}

function adminMemberFilters(input: unknown): FilterSpec[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const filters: FilterSpec[] = [];
  for (const candidate of input) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      continue;
    }
    const field = Reflect.get(candidate, 'field');
    const op = adminMemberFilterOp(Reflect.get(candidate, 'op'));
    const value = Reflect.get(candidate, 'value');
    if (typeof field !== 'string' || !adminMemberFilterFields.has(field) || op === null) {
      continue;
    }
    if (op === FilterOp.IN) {
      if (!Array.isArray(value)) {
        continue;
      }
      const values = value
        .filter((item): item is string | number | boolean => ['string', 'number', 'boolean'].includes(typeof item))
        .map(String);
      if (values.length > 0) {
        filters.push(create(FilterSpecSchema, { field, op, values }));
      }
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      filters.push(create(FilterSpecSchema, { field, op, value: String(value) }));
    }
  }
  return filters;
}

export async function listUsersAdminAction(input: UserListInput) {
  try {
    const memberClient = await createMemberClient();
    const { page = 1, pageSize = 20, search, sort } = input;
    const filters = search ? [create(FilterSpecSchema, { field: 'search', op: FilterOp.ILIKE, value: search })] : [];
    filters.push(...adminMemberFilters(input.filter));

    const response = await memberClient.listMembersAdmin({
      pagination: create(PaginationRequestSchema, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      }),
      filters,
      sorts: sort?.map((s) =>
        create(SortSpecSchema, {
          field: s.field,
          order: s.order === 'asc' ? SortOrder.ASC : SortOrder.DESC,
        }),
      ),
    });

    const total = response.pagination?.total ?? 0;

    return {
      data: (response.members ?? []).flatMap((item) => {
        const summary = item.member?.summary;
        const nickname = summary?.nickname.trim();
        if (!summary?.id || !nickname) {
          return [];
        }
        return [
          {
            id: summary.id,
            email: item.account?.canonicalEmail?.email ?? null,
            nickname,
            image: summary.avatarAsset?.url ?? null,
            role: accountRoleToString(item.account?.role ?? AuthorizationRole.UNSPECIFIED),
            banned: item.account?.banned ?? false,
            onboarded: item.onboarded,
            email_verified: item.account?.canonicalEmail?.verified ?? false,
            status: accountStatusToString(item.account?.status ?? AccountStatus.UNSPECIFIED),
            newsletter_subscribed: item.newsletterSubscription?.subscribed ?? false,
            newsletter_subscribed_at: item.newsletterSubscription?.subscribedAt
              ? timestampDate(item.newsletterSubscription.subscribedAt)
              : null,
            created_at: item.member?.createdAt ? timestampDate(item.member.createdAt) : new Date(),
          },
        ];
      }),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('RPC error', { error: err.message });
    }
    return { data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
}

export async function updateUserAction(
  id: string,
  data: {
    nickname?: string;
    bio?: string | null;
    website?: string | null;
    social_links?: Record<string, string> | null;
    role?: string;
    tag_ids?: string[];
  },
): Promise<{ success?: boolean; error?: string }> {
  try {
    const memberClient = await createMemberClient();
    const accountClient = await createAccountClient();

    await memberClient.updateMemberProfile({
      memberId: id,
      nickname: data.nickname,
      ...(data.bio !== undefined && { bio: data.bio ?? '' }),
      ...(data.website !== undefined && { website: data.website ?? '' }),
      ...(data.social_links !== undefined && { socialLinks: data.social_links ?? {} }),
    });

    if (data.tag_ids) {
      await memberClient.setMemberTags({
        memberId: id,
        tagIds: data.tag_ids,
      });
    }

    // Update role if changed
    if (data.role) {
      await accountClient.setAccountRole({
        memberId: id,
        role: stringToAuthorizationRole(data.role),
      });
    }

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to update user',
      ...(nicknameErrorCode(err) && { errorCode: nicknameErrorCode(err) }),
    };
  }
}

export async function banUserAction(
  id: string,
  reason?: string,
  banExpiresIn?: number,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const accountClient = await createAccountClient();

    await accountClient.banAccount({
      memberId: id,
      reason,
      until: banExpiresIn ? timestampFromDate(new Date(Date.now() + banExpiresIn * 1000)) : undefined,
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to ban user' };
  }
}

export async function unbanUserAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const accountClient = await createAccountClient();

    await accountClient.unbanAccount({
      memberId: id,
    });

    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to unban user' };
  }
}

export async function setUserCanonicalEmailAction(
  id: string,
  email: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const accountClient = await createAccountClient();
    await accountClient.setAccountCanonicalEmail({ memberId: id, email });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update canonical account email' };
  }
}

export async function removeUserSsoProviderAction(
  id: string,
  provider: string,
  identifier: string,
): Promise<{ success?: boolean; error?: string }> {
  try {
    const accountClient = await createAccountClient();
    await accountClient.removeAccountSsoProvider({ memberId: id, provider, identifier });
    revalidatePath('/admin/users');
    revalidatePath(`/admin/users/${id}`);
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to remove SSO provider' };
  }
}

export async function deleteUserAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const accountClient = await createAccountClient();
    await accountClient.deleteAccount({ memberId: id });
    revalidatePath('/admin/users');
    return { success: true };
  } catch (err) {
    if (isConnectError(err)) {
      return { error: err.message };
    }
    return { error: err instanceof Error ? err.message : 'Failed to delete user' };
  }
}

export async function getUserAdminAction(id: string) {
  try {
    const memberClient = await createMemberClient();
    const result = await memberClient.getMember({ memberId: id });
    const profile = result.member;
    const summary = profile?.summary;
    const account = result.account;
    const nickname = summary?.nickname.trim();
    if (!profile || !summary || !account || !nickname) {
      return null;
    }

    return {
      id: summary.id,
      tag_ids: result.tagIds,
      email: account.canonicalEmail?.email ?? null,
      nickname,
      image: summary.avatarAsset?.url ?? null,
      bio: profile.bio ?? null,
      website: profile.website ?? null,
      social_links: profile.socialLinks,
      role: accountRoleToString(account.role),
      banned: account.banned,
      onboarded: result.onboarded,
      email_verified: account.canonicalEmail?.verified ?? false,
      ban_reason: account.banDetails?.reason ?? null,
      ban_expires: account.banDetails?.expiresAt ? timestampDate(account.banDetails.expiresAt) : null,
      status: accountStatusToString(account.status),
      newsletter_subscribed: result.newsletterSubscription?.subscribed ?? false,
      newsletter_subscribed_at: result.newsletterSubscription?.subscribedAt
        ? timestampDate(result.newsletterSubscription.subscribedAt)
        : null,
      auth_details: mapAccountAdminDetails(result.accountDetails),
      ban_details: mapAccountBanDetails(account.banDetails),
      created_at: profile.createdAt ? timestampDate(profile.createdAt) : new Date(),
      updated_at: profile.updatedAt ? timestampDate(profile.updatedAt) : null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('RPC error', { error: err.message });
    }
    return null;
  }
}

function mapAccountAdminDetails(
  details: AccountAdminDetails | undefined,
): import('@/lib/types/user/model').AdminUserAuthDetails | null {
  if (!details) {
    return null;
  }

  return {
    providers: details.providers.map((provider) => ({
      provider: provider.provider,
      identifier: provider.identifier,
    })),
    email_candidates: details.emailCandidates.map((candidate) => ({
      email: candidate.email,
      normalized_email: candidate.normalizedEmail,
      current: candidate.current,
      kratos_verified: candidate.identityVerified,
      effective_trusted: candidate.effectiveTrusted,
      usable_for_delivery: candidate.usableForDelivery,
      sources: candidate.sources.map((source) => ({
        source_type: accountEmailSourceTypeToString(source.sourceType),
        provider: source.provider ?? null,
        provider_subject: source.providerSubject ?? null,
      })),
    })),
  };
}

function accountEmailSourceTypeToString(
  sourceType: AccountEmailSourceType,
): import('@/lib/types/user/model').AdminUserAuthEmailSourceType {
  switch (sourceType) {
    case AccountEmailSourceType.IDENTITY_CURRENT:
      return 'kratos_current';
    case AccountEmailSourceType.EMAIL_CODE:
      return 'email_code';
    case AccountEmailSourceType.OIDC_PROVIDER:
      return 'oidc_provider';
    default:
      return 'unknown';
  }
}

function mapAccountBanDetails(details: ProtoAccountBanDetails | undefined): AdminUserBanDetails | null {
  if (!details) {
    return null;
  }

  return {
    metadata_banned: details.metadataBanned,
    identity_state: details.identityState,
    inactive_state: details.inactiveState,
    reason: details.reason ?? null,
    expires_at: details.expiresAt ? timestampDate(details.expiresAt) : null,
  };
}

// Public: list authors for page blocks
export async function listAuthorOptionsAction(limit: number = 12) {
  return queryListAuthorOptions(limit);
}

export async function listAuthorsAction(limit: number = 12, memberIds: string[] = []) {
  return memberIds.length > 0 ? queryListAuthors(limit, memberIds) : queryListAuthors(limit);
}

// === User Profile Actions ===

export async function updateProfileAction(data: {
  nickname?: string;
  bio?: string | null;
  website?: string | null;
  social_links?: Record<string, string> | null;
}): Promise<{ member?: MemberSummaryResult; error?: string; errorCode?: NicknameErrorCode }> {
  try {
    const memberClient = await createMemberClient();

    const response = await memberClient.updateMyProfile({
      nickname: data.nickname?.trim(),
      ...(data.bio !== undefined && { bio: data.bio ?? '' }),
      ...(data.website !== undefined && { website: data.website ?? '' }),
      ...(data.social_links !== undefined && { socialLinks: data.social_links ?? {} }),
    });

    return { member: mapMemberSummary(response.member) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to update profile',
      ...(nicknameErrorCode(err) && { errorCode: nicknameErrorCode(err) }),
    };
  }
}

export type NicknameErrorCode = 'nickname_invalid' | 'nickname_unavailable';

function nicknameErrorCode(error: unknown): NicknameErrorCode | undefined {
  if (!isConnectError(error)) {
    return undefined;
  }
  if (error.code === Code.AlreadyExists) {
    return 'nickname_unavailable';
  }
  if (error.code === Code.InvalidArgument) {
    return 'nickname_invalid';
  }
  return undefined;
}

export async function checkNicknameAvailabilityAction(
  nickname: string,
): Promise<{ available?: boolean; error?: string }> {
  try {
    const memberClient = await createMemberClient();
    const response = await memberClient.checkNicknameAvailability({ nickname: nickname.trim() });
    return { available: response.available };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to check nickname availability' };
  }
}

export async function completeMyOnboardingAction(nickname: string): Promise<{
  member?: MemberSummaryResult;
  onboarded?: boolean;
  error?: string;
  errorCode?: NicknameErrorCode;
}> {
  try {
    const memberClient = await createMemberClient();
    const response = await memberClient.completeMyOnboarding({ nickname: nickname.trim() });
    const member = mapMemberSummary(response.member);
    if (!response.onboarded || !member) {
      return { error: 'Onboarding did not complete' };
    }
    return { member, onboarded: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to complete onboarding',
      ...(nicknameErrorCode(err) && { errorCode: nicknameErrorCode(err) }),
    };
  }
}

// === Avatar Actions ===

export interface MemberSummaryResult {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  deleted: boolean;
}

function mapMemberSummary(
  summary: import('@echovisionlab/geul-proto/common/common_pb.ts').MemberSummary | undefined,
): MemberSummaryResult | undefined {
  const nickname = summary?.nickname.trim();
  if (!summary || !nickname) {
    return undefined;
  }
  return {
    id: summary.id,
    nickname,
    avatarUrl: summary.avatarAsset?.url ?? null,
    deleted: summary.deleted,
  };
}

export async function setAvatarAction(fileId: string): Promise<{ member?: MemberSummaryResult; error?: string }> {
  try {
    const memberClient = await createMemberClient();

    const response = await memberClient.setMyAvatar({
      fileId,
    });

    return { member: mapMemberSummary(response.member) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to set avatar' };
  }
}

export async function setAvatarForMemberAction(
  memberId: string,
  fileId: string,
): Promise<{ url?: string; error?: string }> {
  try {
    const memberClient = await createMemberClient();

    const response = await memberClient.setMemberAvatar({
      memberId,
      fileId,
    });

    return { url: response.member?.avatarAsset?.url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to set avatar' };
  }
}

export async function deleteAvatarAction(): Promise<{ member?: MemberSummaryResult; error?: string }> {
  try {
    const memberClient = await createMemberClient();

    const response = await memberClient.deleteMyAvatar({});

    return { member: mapMemberSummary(response.member) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete avatar' };
  }
}

export async function deleteAvatarForMemberAction(memberId: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const memberClient = await createMemberClient();

    await memberClient.deleteMemberAvatar({
      memberId,
    });

    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete avatar' };
  }
}

function stringToAuthorizationRole(role: string): AuthorizationRole {
  switch (role) {
    case 'user':
      return AuthorizationRole.USER;
    case 'admin':
      return AuthorizationRole.ADMIN;
    case 'author':
      return AuthorizationRole.AUTHOR;
    default:
      return AuthorizationRole.USER;
  }
}
