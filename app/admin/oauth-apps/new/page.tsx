import { OAuthAppEditor } from '@/features/admin/oauth-app/OAuthAppEditor';
import { loadSignInMemberCriteria } from '@/lib/actions/oauth-app-criteria';

export default async function NewOAuthAppPage() {
  return <OAuthAppEditor app={null} memberCriteria={await loadSignInMemberCriteria()} />;
}
