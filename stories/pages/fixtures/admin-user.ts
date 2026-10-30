import type { AdminUserEditPageBindings } from '@/features/admin/user/AdminUserEditPage';
import { actionFailure, actionSuccess } from '@/lib/actions/action-result';
import type { QueryResult } from '@/lib/api/query-result';
export type AdminUserPreviewState = 'ready' | 'banned' | 'failed' | 'pending' | 'action-failed';
export function adminUserFixture(state: AdminUserPreviewState): AdminUserEditPageBindings {
  type User = NonNullable<
    Extract<Awaited<ReturnType<AdminUserEditPageBindings['getUserAdminAction']>>, { ok: true }>['value']
  >;
  const date = new Date('2026-10-01T00:00:00Z');
  let user: User = {
    id: 'local-member',
    tag_ids: [],
    email: 'june@example.com',
    nickname: 'June Han',
    image: null,
    bio: 'Field recordings and shared listening.',
    website: 'https://example.com',
    social_links: {},
    role: 'author',
    banned: state === 'banned',
    onboarded: true,
    email_verified: true,
    ban_reason: state === 'banned' ? 'Local fixture moderation' : null,
    ban_expires: null,
    status: state === 'banned' ? 'banned' : 'active',
    newsletter_subscribed: true,
    newsletter_subscribed_at: date,
    auth_details: null,
    ban_details: null,
    created_at: date,
    updated_at: date,
  };
  const read = async <T>(value: T): Promise<QueryResult<T>> => {
    if (state === 'pending') {
      return new Promise(() => {});
    }
    if (state === 'failed') {
      return { ok: false, status: 500, error: 'Local member lookup failed' };
    }
    return { ok: true, value };
  };
  const mutation = async () => (state === 'action-failed' ? { error: 'Local operation failed' } : { success: true });
  return {
    getUserAdminAction: async () => read(user),
    listAllUserTagsAction: async () => read([]),
    getEmailSuppressionAction: async () => read(null),
    listAccountPersonalAccessTokensAction: async () => ({ personalAccessTokens: [] }),
    updateUserAction: async (_id, patch) => {
      if (state === 'action-failed') {
        return actionFailure('Local update failed', 'ACTION_FAILED');
      }
      user = {
        ...user,
        nickname: patch.nickname ?? user.nickname,
        role: patch.role === 'admin' || patch.role === 'author' || patch.role === 'user' ? patch.role : user.role,
        bio: patch.bio === undefined ? user.bio : patch.bio,
        website: patch.website === undefined ? user.website : patch.website,
      };
      return actionSuccess({ success: true as const });
    },
    banUserAction: async (_id, reason) => {
      if (state === 'action-failed') {
        return actionFailure('Local moderation failed', 'ACTION_FAILED');
      }
      user = { ...user, banned: true, status: 'banned', ban_reason: reason ?? null };
      return actionSuccess({ success: true as const });
    },
    unbanUserAction: async () => {
      if (state === 'action-failed') {
        return actionFailure('Local moderation failed', 'ACTION_FAILED');
      }
      user = { ...user, banned: false, status: 'active', ban_reason: null };
      return actionSuccess({ success: true as const });
    },
    setUserCanonicalEmailAction: async (_id, email) => {
      if (state === 'action-failed') {
        return actionFailure('Local email update failed', 'ACTION_FAILED');
      }
      user = { ...user, email };
      return actionSuccess({ success: true as const });
    },
    removeUserSsoProviderAction: async () =>
      state === 'action-failed'
        ? actionFailure('Local operation failed', 'ACTION_FAILED')
        : actionSuccess({ success: true as const }),
    releaseEmailSuppressionAction: async () =>
      state === 'action-failed'
        ? actionFailure('Local operation failed', 'ACTION_FAILED')
        : actionSuccess({ success: true as const }),
  };
}
