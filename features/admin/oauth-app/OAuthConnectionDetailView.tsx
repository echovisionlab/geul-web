'use client';
import { IconArrowLeft, IconPlugConnectedX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { MetadataPair } from '@/components/core/PublicMetadata';
import { SettingsSection } from '@/components/core/Section';
import { SupportingText, Text } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { DateTime } from '@/features/date-time/DateTime';
import type { OAuthConnectionDetail } from './model';

const KNOWN_AUTH_METHODS = ['client_secret_basic', 'client_secret_post', 'private_key_jwt', 'none'] as const;

/** Tools register their own method; one the site does not name shows as registered. */
function isKnownAuthMethod(method: string): method is (typeof KNOWN_AUTH_METHODS)[number] {
  return (KNOWN_AUTH_METHODS as readonly string[]).includes(method);
}

export interface OAuthConnectionDetailViewProps {
  connection: OAuthConnectionDetail;
  backHref: string;
  disconnecting?: boolean;
  onDisconnect: () => Promise<boolean>;
}

/** Read-only details of a connected AI tool; the tool registered itself, so the only change is disconnecting it. */
export function OAuthConnectionDetailView({
  connection,
  backHref,
  disconnecting = false,
  onDisconnect,
}: OAuthConnectionDetailViewProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');
  const [confirming, setConfirming] = useState(false);

  return (
    <LayoutStack gap="xl">
      <AdminPageHeader
        title={connection.name}
        description={t('connections.detailDescription')}
        items={[
          {
            key: 'back',
            type: 'action',
            label: tCommon('actions.back'),
            href: backHref,
            icon: <IconArrowLeft aria-hidden />,
          },
        ]}
      />
      {connection.stale && <Alert tone="warning">{t('connections.staleWarning')}</Alert>}
      <SettingsSection title={t('sections.connection')}>
        <MetadataPair label={t('fields.clientId')}>
          <Text font="mono" wrap="anywhere">
            {connection.clientId}
          </Text>
        </MetadataPair>
        <MetadataPair label={t('fields.publisher')}>
          <Text>{connection.publisher ?? t('connections.generatedId')}</Text>
        </MetadataPair>
        <MetadataPair label={t('fields.resource')}>
          <Text font="mono" wrap="anywhere">
            {connection.resource}
          </Text>
        </MetadataPair>
        <MetadataPair label={t('fields.redirectUris')}>
          <LayoutStack gap="xxs">
            {connection.redirectUris.map((uri) => (
              <Text key={uri} font="mono" wrap="anywhere">
                {uri}
              </Text>
            ))}
          </LayoutStack>
        </MetadataPair>
        <MetadataPair label={t('fields.authMethod')}>
          <Text>
            {isKnownAuthMethod(connection.authMethod)
              ? t(`authMethods.${connection.authMethod}`)
              : connection.authMethod}
          </Text>
        </MetadataPair>
        {connection.createdAt && (
          <MetadataPair label={tCommon('labels.created')}>
            <DateTime value={connection.createdAt} />
          </MetadataPair>
        )}
      </SettingsSection>
      <SettingsSection title={t('sections.manage')}>
        <div>
          <Button
            tone="danger"
            leftSection={<IconPlugConnectedX aria-hidden />}
            loading={disconnecting}
            onClick={() => setConfirming(true)}
          >
            {t('disconnect')}
          </Button>
        </div>
        <SupportingText>{t('help.disconnect')}</SupportingText>
      </SettingsSection>
      <ConfirmationDialog
        intent="revoke"
        opened={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={async () => {
          if (await onDisconnect()) {
            setConfirming(false);
          }
        }}
        title={t('disconnectTitle')}
        message={<Text>{t('disconnectConfirm', { name: connection.name })}</Text>}
        confirmLabel={t('disconnect')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={disconnecting}
      />
    </LayoutStack>
  );
}
