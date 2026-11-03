'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { notifications } from '@/components/core/Notification';
import { Text } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation/ui/ConfirmationDialog';
import { disconnectConnectedToolAction } from '@/lib/actions/oauth-apps';
import type { OAuthConnectionSummary, OAuthSignInAppSummary } from './model';
import { OAuthAppListView } from './OAuthAppListView';
import { NEW_OAUTH_APP_PATH, connectedToolPath, oauthAppPath } from './paths';

export interface OAuthAppsPageProps {
  siteName: string;
  apps: OAuthSignInAppSummary[];
  connections: OAuthConnectionSummary[];
  loadFailed: boolean;
}

/** The OAuth apps list, with disconnecting an AI tool from its row. */
export function OAuthAppsPage({ siteName, apps, connections, loadFailed }: OAuthAppsPageProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [pending, setPending] = useState<OAuthConnectionSummary | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const disconnect = async () => {
    if (!pending) {
      return;
    }
    setDisconnecting(true);
    const result = await disconnectConnectedToolAction(pending.clientId);
    setDisconnecting(false);
    if (!result.ok) {
      notifications.show({ message: result.error, tone: 'danger' });
      return;
    }
    notifications.show({ message: t('disconnected', { name: pending.name }), tone: 'positive' });
    setPending(null);
    router.refresh();
  };

  return (
    <>
      <OAuthAppListView
        siteName={siteName}
        apps={apps}
        connections={connections}
        loadFailed={loadFailed}
        getAppHref={oauthAppPath}
        getConnectionHref={connectedToolPath}
        createHref={NEW_OAUTH_APP_PATH}
        onOpen={(href) => router.push(href)}
        onDisconnect={setPending}
      />
      <ConfirmationDialog
        intent="revoke"
        opened={pending !== null}
        onClose={() => setPending(null)}
        onConfirm={disconnect}
        title={t('disconnectTitle')}
        message={<Text>{t('disconnectConfirm', { name: pending?.name ?? '' })}</Text>}
        confirmLabel={t('disconnect')}
        cancelLabel={tCommon('actions.cancel')}
        closeLabel={tCommon('actions.close')}
        loading={disconnecting}
      />
    </>
  );
}
