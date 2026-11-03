'use client';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { notifications } from '@/components/core/Notification';
import { disconnectConnectedToolAction } from '@/lib/actions/oauth-apps';
import type { OAuthConnectionDetail as Connection } from './model';
import { OAuthConnectionDetailView } from './OAuthConnectionDetailView';
import { OAUTH_APPS_PATH } from './paths';

/** A connected AI tool's details, with disconnecting it. */
export function OAuthConnectionDetail({ connection }: { connection: Connection }) {
  const t = useTranslations('adminList.oauthApps');
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);

  const disconnect = async () => {
    setDisconnecting(true);
    const result = await disconnectConnectedToolAction(connection.clientId);
    setDisconnecting(false);
    if (!result.ok) {
      notifications.show({ message: result.error, tone: 'danger' });
      return false;
    }
    notifications.show({ message: t('disconnected', { name: connection.name }), tone: 'positive' });
    router.replace(OAUTH_APPS_PATH);
    return true;
  };

  return (
    <OAuthConnectionDetailView
      connection={connection}
      backHref={OAUTH_APPS_PATH}
      disconnecting={disconnecting}
      onDisconnect={disconnect}
    />
  );
}
