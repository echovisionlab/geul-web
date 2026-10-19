'use client';
import type { ComponentProps } from 'react';
import { useTranslations } from 'next-intl';
import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { CookieConsentSettings } from '@/features/my/CookieConsentSettings';
import { LanguagePreferenceSettings } from '@/features/my/LanguagePreferenceSettings';
import { McpOAuthGrantSettings } from '@/features/my/McpOAuthGrantSettings';
import { PersonalAccessTokenSettings } from '@/features/my/PersonalAccessTokenSettings';
import { SettingsForm } from '@/features/my/SettingsForm';
import { LocalBackups } from '@/features/my/LocalBackups';
import { LocalBackupsView, type LocalBackupsViewProps } from '@/features/my/LocalBackupsView';
import { McpIntegrationSettingsView } from '@/features/my/ui/McpIntegrationSettings';
interface Props {
  email: string | null;
  preferredLocale: string | null;
  subscribed: boolean;
  analytics: boolean | null;
  cookieUpdatedAt: string | null;
  subjectId: string;
  canAccessMcp: boolean;
  personalAccessTokenItems: ComponentProps<typeof PersonalAccessTokenSettings>['initialPersonalAccessTokens'];
  tokensLoadFailed: boolean;
  grants: ComponentProps<typeof McpOAuthGrantSettings>['initialGrants'];
  grantsLoadFailed: boolean;
  endpoint: string;
  setupGuideUrl: string;
  preferences?: {
    language?: ComponentProps<typeof LanguagePreferenceSettings>['updateAction'];
    newsletter?: ComponentProps<typeof SettingsForm>['updateAction'];
    cookies?: ComponentProps<typeof CookieConsentSettings>['persistAction'];
    refresh?: () => void;
  };
  tokenBindings?: ComponentProps<typeof PersonalAccessTokenSettings>['bindings'];
  revokeGrant?: ComponentProps<typeof McpOAuthGrantSettings>['revokeAction'];
  localBackups?: LocalBackupsViewProps;
}
export function MySettingsPageView({
  email,
  preferredLocale,
  subscribed,
  analytics,
  cookieUpdatedAt,
  subjectId,
  canAccessMcp,
  personalAccessTokenItems,
  tokensLoadFailed,
  grants,
  grantsLoadFailed,
  endpoint,
  setupGuideUrl,
  preferences,
  tokenBindings,
  revokeGrant,
  localBackups,
}: Props) {
  const t = useTranslations('settings.page');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  return (
    <DsLayoutStack gap="xl">
      <DsHeading level={1} scale={2}>
        {tCommonLabels('settings')}
      </DsHeading>

      {localBackups ? <LocalBackupsView {...localBackups} /> : <LocalBackups />}

      <DsSectionCard padding="none" appearance="plain" withBorder={false}>
        <DsLayoutStack gap="md">
          <div>
            <DsText size="sm" weight="medium">
              {tCommonLabels('email')}
            </DsText>
            <DsText size="sm" tone="secondary">
              {email || tCommonStates('notAvailable')}
            </DsText>
          </div>
        </DsLayoutStack>
      </DsSectionCard>

      <DsSectionCard padding="none" appearance="plain" withBorder={false}>
        <DsLayoutStack gap="md">
          <DsHeading level={2} scale={4}>
            {tCommonLabels('language')}
          </DsHeading>
          <LanguagePreferenceSettings
            updateAction={preferences?.language}
            refresh={preferences?.refresh}
            initialLocale={preferredLocale ?? null}
          />
        </DsLayoutStack>
      </DsSectionCard>

      <DsSectionCard padding="none" appearance="plain" withBorder={false}>
        <DsLayoutStack gap="md">
          <DsHeading level={2} scale={4}>
            {t('newsletterTitle')}
          </DsHeading>
          <SettingsForm updateAction={preferences?.newsletter} initialSettings={{ subscribed }} />
        </DsLayoutStack>
      </DsSectionCard>

      <DsSectionCard padding="none" appearance="plain" withBorder={false}>
        <DsLayoutStack gap="md">
          <DsHeading level={2} scale={4}>
            {t('cookiePreferencesTitle')}
          </DsHeading>
          <CookieConsentSettings
            persistAction={preferences?.cookies}
            initialAnalytics={analytics}
            initialUpdatedAt={cookieUpdatedAt}
          />
        </DsLayoutStack>
      </DsSectionCard>

      <PersonalAccessTokenSettings
        bindings={tokenBindings}
        subjectId={subjectId}
        initialPersonalAccessTokens={personalAccessTokenItems}
        initialLoadFailed={tokensLoadFailed}
      />

      {canAccessMcp ? (
        <>
          <McpIntegrationSettingsView
            endpoint={endpoint}
            setupGuideUrl={setupGuideUrl}
            labels={{
              title: 'Remote MCP',
              endpoint: tCommonLabels('url'),
              openGuide: tCommonActions('openInNewTab'),
            }}
          />
          <McpOAuthGrantSettings
            revokeAction={revokeGrant}
            initialGrants={grants}
            initialLoadFailed={grantsLoadFailed}
          />
        </>
      ) : null}
    </DsLayoutStack>
  );
}
