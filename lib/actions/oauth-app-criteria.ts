import 'server-only';

import type { OAuthMemberCriteriaOption } from '@/features/admin/oauth-app/model';
import { listMemberCriteriaForAuthenticatedAccessAction } from '@/lib/actions/file-download-access';

/** The Member criteria that can admit Members, the list restricted downloads use. */
export async function loadSignInMemberCriteria(): Promise<OAuthMemberCriteriaOption[]> {
  const result = await listMemberCriteriaForAuthenticatedAccessAction({ pageSize: 100 });
  return (result.data?.items ?? []).map(({ id, name }) => ({ id, name }));
}
