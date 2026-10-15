import type { PersonalAccessTokenBindings } from '@/features/my/PersonalAccessTokenSettings';
import type { PersonalAccessTokenSummary } from '@/lib/actions/personal-access-token';

/** Local controller transport: these preview secrets cannot authenticate against any service. */
export function createLocalTokenBindings(failed = false): PersonalAccessTokenBindings {
  let token: PersonalAccessTokenSummary | null = null;
  const issue = async () => {
    if (failed) {
      return { error: 'request_failed' as const };
    }
    token = { id: `preview-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
    return { personalAccessToken: token, secret: `preview-only-${crypto.randomUUID()}` };
  };
  const regenerate = async (id: string) => {
    if (failed) {
      return { error: 'request_failed' as const };
    }
    if (token?.id !== id) {
      return { error: 'invalid_request' as const };
    }
    return issue();
  };
  const remove = async (id: string) => {
    if (failed) {
      return { deleted: false, error: 'request_failed' as const };
    }
    const deleted = token?.id === id;
    if (deleted) {
      token = null;
    }
    return { deleted };
  };
  return {
    createAccountPersonalAccessTokenAction: issue,
    createMyPersonalAccessTokenAction: issue,
    deleteAccountPersonalAccessTokenAction: (_memberId, id) => remove(id),
    deleteMyPersonalAccessTokenAction: remove,
    regenerateAccountPersonalAccessTokenAction: (_memberId, id) => regenerate(id),
    regenerateMyPersonalAccessTokenAction: regenerate,
  };
}
