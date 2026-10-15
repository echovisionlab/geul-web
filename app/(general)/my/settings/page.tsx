import { MySettingsPageView } from '@/features/my/MySettingsPageView';
import { redirect } from 'next/navigation';
import { timestampDate } from '@bufbuild/protobuf/wkt';

import {
  canAccessMcpIntegrationSettings,
  projectPersonalAccessTokensForSettings,
} from '@/features/my/mcp-integration-access';
import { listMyMcpOAuthGrants } from '@/features/my/mcp-oauth-grant-actions';
import { listMyPersonalAccessTokensAction } from '@/lib/actions/personal-access-token';
import { createMemberClient } from '@/lib/api/server-client';
import { getSession, getUserRole } from '@/lib/utils/session.server';
import { joinUrl } from '@/lib/utils/url';
import { getBaseUrl } from '@/lib/utils/url.server';

export default async function MySettingsPage() {
  const session = await getSession();
  if (!session?.user) {
    redirect('/login');
  }
  const client = await createMemberClient();
  const [settings, personalAccessTokens, role, baseUrl] = await Promise.all([
    client.getMySettings({}),
    listMyPersonalAccessTokensAction(),
    getUserRole(),
    getBaseUrl(),
  ]);
  const effectiveEmail = settings.canonicalEmail?.email ?? null;
  const canAccessMcp = canAccessMcpIntegrationSettings(role);
  const personalAccessTokenItems = projectPersonalAccessTokensForSettings(personalAccessTokens.personalAccessTokens);
  const mcpOAuthGrants = canAccessMcp ? await listMyMcpOAuthGrants() : { grants: [] };

  return (
    <MySettingsPageView
      email={effectiveEmail}
      preferredLocale={settings.preferredLocale ?? null}
      subscribed={settings.newsletterSubscription?.subscribed ?? false}
      analytics={settings.cookieConsent?.analytics ?? null}
      cookieUpdatedAt={
        settings.cookieConsent?.updatedAt ? timestampDate(settings.cookieConsent.updatedAt).toISOString() : null
      }
      subjectId={session.user.id}
      canAccessMcp={canAccessMcp}
      personalAccessTokenItems={personalAccessTokenItems}
      tokensLoadFailed={Boolean(personalAccessTokens.error)}
      grants={mcpOAuthGrants.grants}
      grantsLoadFailed={Boolean(mcpOAuthGrants.error)}
      endpoint={joinUrl(baseUrl, '/mcp')}
      setupGuideUrl={joinUrl(baseUrl, '/guides/remote-mcp.md')}
    />
  );
}
