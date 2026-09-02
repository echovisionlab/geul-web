import { redirect } from 'next/navigation';
import { timestampDate } from '@bufbuild/protobuf/wkt';
import { getTranslations } from 'next-intl/server';
import { Divider, Paper, Stack, Text, Title } from '@mantine/core';
import { CookieConsentSettings } from '@/features/my/CookieConsentSettings';
import { LanguagePreferenceSettings } from '@/features/my/LanguagePreferenceSettings';
import {
  canAccessMcpIntegrationSettings,
  projectPersonalAccessTokensForSettings,
} from '@/features/my/mcp-integration-access';
import { McpOAuthGrantSettings } from '@/features/my/McpOAuthGrantSettings';
import { listMyMcpOAuthGrants } from '@/features/my/mcp-oauth-grant-actions';
import { PersonalAccessTokenSettings } from '@/features/my/PersonalAccessTokenSettings';
import { SettingsForm } from '@/features/my/SettingsForm';
import { McpIntegrationSettingsView } from '@/features/my/ui/McpIntegrationSettings';
import { listMyPersonalAccessTokensAction } from '@/lib/actions/personal-access-token';
import { createMemberClient } from '@/lib/api/server-client';
import { getSession, getUserRole } from '@/lib/utils/session.server';
import { joinUrl } from '@/lib/utils/url';
import { getBaseUrl } from '@/lib/utils/url.server';

export default async function MySettingsPage() {
  const t = await getTranslations('settings.page');
  const tSecurity = await getTranslations('security');
  const tCommonActions = await getTranslations('common.actions');
  const tCommonLabels = await getTranslations('common.labels');
  const tCommonStates = await getTranslations('common.states');
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
    <Stack>
      <Title order={2} mb="md">
        {tCommonLabels('settings')}
      </Title>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <div>
            <Text size="sm" fw={500}>
              {tCommonLabels('email')}
            </Text>
            <Text size="sm" c="dimmed">
              {effectiveEmail || tCommonStates('notAvailable')}
            </Text>
          </div>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={5}>{tCommonLabels('language')}</Title>
          <LanguagePreferenceSettings initialLocale={settings.preferredLocale ?? null} />
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={5}>{t('newsletterTitle')}</Title>
          <SettingsForm initialSettings={{ subscribed: settings.newsletterSubscription?.subscribed ?? false }} />
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Stack gap="md">
          <Title order={5}>{t('cookiePreferencesTitle')}</Title>
          <CookieConsentSettings
            initialAnalytics={settings.cookieConsent?.analytics ?? null}
            initialUpdatedAt={
              settings.cookieConsent?.updatedAt ? timestampDate(settings.cookieConsent.updatedAt).toISOString() : null
            }
          />
        </Stack>
      </Paper>

      <Divider my="sm" />

      <PersonalAccessTokenSettings
        subjectId={session.user.id}
        initialPersonalAccessTokens={personalAccessTokenItems}
        initialLoadFailed={Boolean(personalAccessTokens.error)}
      />

      {canAccessMcp ? (
        <>
          <Divider my="sm" />
          <McpIntegrationSettingsView
            endpoint={joinUrl(baseUrl, '/mcp')}
            setupGuideUrl={joinUrl(baseUrl, '/guides/remote-mcp.md')}
            labels={{
              title: 'Remote MCP',
              description: tSecurity('mcpIntegration.description'),
              endpoint: tCommonLabels('url'),
              openGuide: tCommonActions('openInNewTab'),
            }}
          />
          <McpOAuthGrantSettings
            initialGrants={mcpOAuthGrants.grants}
            initialLoadFailed={Boolean(mcpOAuthGrants.error)}
          />
        </>
      ) : null}
    </Stack>
  );
}
