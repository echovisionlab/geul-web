import { OAuthAppsPage } from '@/features/admin/oauth-app/OAuthAppsPage';
import { listConnectedToolsAction, listSignInAppsAction } from '@/lib/actions/oauth-apps';
import { unwrapQueryResult, type QueryResult } from '@/lib/api/query-result';
import { getSettings } from '@/lib/queries/manifest';

/** A lost session ends the request; Hydra or the API being down shows the list's load failure instead. */
function listOrEmpty<T>(result: QueryResult<T[]>): T[] | null {
  if (result.ok) {
    return result.value;
  }
  if (result.status === 401 || result.status === 403) {
    unwrapQueryResult(result);
  }
  return null;
}

export default async function OAuthAppsAdminPage() {
  const [settings, appsResult, connectionsResult] = await Promise.all([
    getSettings(),
    listSignInAppsAction(),
    listConnectedToolsAction(),
  ]);
  const apps = listOrEmpty(appsResult);
  const connections = listOrEmpty(connectionsResult);
  return (
    <OAuthAppsPage
      siteName={settings.site_title || 'Site'}
      apps={apps ?? []}
      connections={connections ?? []}
      loadFailed={apps === null || connections === null}
    />
  );
}
