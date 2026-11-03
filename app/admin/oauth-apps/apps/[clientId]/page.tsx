import { OAuthAppEditor } from '@/features/admin/oauth-app/OAuthAppEditor';
import { loadSignInMemberCriteria } from '@/lib/actions/oauth-app-criteria';
import { getSignInAppAction } from '@/lib/actions/oauth-apps';
import { unwrapQueryResult } from '@/lib/api/query-result';

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function EditOAuthAppPage({ params }: PageProps) {
  const { clientId } = await params;
  const [app, memberCriteria] = await Promise.all([
    getSignInAppAction(decodeURIComponent(clientId)).then(unwrapQueryResult),
    loadSignInMemberCriteria(),
  ]);
  return <OAuthAppEditor key={app.revision} app={app} memberCriteria={memberCriteria} />;
}
