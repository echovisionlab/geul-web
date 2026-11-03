'use client';
import { IconPlus } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { DataTableView, TableRowMenu } from '@/components/core/DataTable';
import { LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SettingsSection } from '@/components/core/Section';
import { SupportingText, Text } from '@/components/core/Typography';
import { AdminPageHeader } from '@/features/admin/ui/AdminPageHeader';
import { DateTime } from '@/features/date-time/DateTime';
import type { OAuthConnectionSummary, OAuthSignInAppSummary } from './model';

export interface OAuthAppListViewProps {
  /** Site title from Site Settings, used in the descriptions. */
  siteName: string;
  apps: OAuthSignInAppSummary[];
  connections: OAuthConnectionSummary[];
  loadFailed?: boolean;
  getAppHref: (clientId: string) => string;
  getConnectionHref: (clientId: string) => string;
  createHref: string;
  onOpen: (href: string) => void;
  onDisconnect: (connection: OAuthConnectionSummary) => void;
}

/** Admin list of sign-in apps and connected AI tools; both are OAuth clients of the site. */
export function OAuthAppListView({
  siteName,
  apps,
  connections,
  loadFailed = false,
  getAppHref,
  getConnectionHref,
  createHref,
  onOpen,
  onDisconnect,
}: OAuthAppListViewProps) {
  const t = useTranslations('adminList.oauthApps');
  const tCommon = useTranslations('common');

  return (
    <LayoutStack gap="xl">
      <AdminPageHeader
        title={t('title')}
        description={t('description', { siteName })}
        items={[
          {
            key: 'create',
            type: 'action',
            label: t('create'),
            href: createHref,
            icon: <IconPlus aria-hidden />,
          },
        ]}
      />
      {loadFailed ? (
        <Alert role="alert" tone="danger">
          {t('loadFailed')}
        </Alert>
      ) : (
        <>
          <SettingsSection title={t('apps.title')} description={t('apps.description', { siteName })}>
            <DataTableView
              accessibleLabel={t('apps.title')}
              rows={apps}
              getRowKey={(app) => app.clientId}
              emptyMessage={t('apps.empty')}
              density="standard"
              mobileLayout="cards"
              rowAction={{
                getHref: (app) => getAppHref(app.clientId),
                onActivate: (app) => onOpen(getAppHref(app.clientId)),
                getAccessibleLabel: (app) => t('openApp', { name: app.name }),
              }}
              columns={[
                {
                  key: 'name',
                  header: tCommon('labels.name'),
                  renderCell: (app) => (
                    <LayoutStack gap="none">
                      <Text weight="medium">{app.name}</Text>
                      <SupportingText font="mono">{app.clientId}</SupportingText>
                    </LayoutStack>
                  ),
                },
                {
                  key: 'signInAccess',
                  header: t('fields.signInAccess'),
                  renderCell: (app) => (
                    <StatusBadge tone="neutral" appearance={app.signInAccess === 'none' ? 'soft' : 'outline'}>
                      {app.signInAccess === 'memberCriteria' && app.memberCriteria.length > 0
                        ? app.memberCriteria.map((criteria) => criteria.name).join(', ')
                        : t(`access.${app.signInAccess}`)}
                    </StatusBadge>
                  ),
                },
                {
                  key: 'redirects',
                  header: t('fields.redirectHosts'),
                  mobileVisibility: 'hidden',
                  renderCell: (app) => (
                    <LayoutInline gap="xs" wrap="wrap">
                      {app.redirectHosts.map((host) => (
                        <LabelBadge key={host}>{host}</LabelBadge>
                      ))}
                    </LayoutInline>
                  ),
                },
                {
                  key: 'created',
                  header: tCommon('labels.created'),
                  mobileVisibility: 'hidden',
                  renderCell: (app) => <DateTime value={app.createdAt} />,
                },
              ]}
            />
          </SettingsSection>
          <SettingsSection title={t('connections.title')} description={t('connections.description')}>
            <DataTableView
              accessibleLabel={t('connections.title')}
              rows={connections}
              getRowKey={(connection) => connection.clientId}
              emptyMessage={t('connections.empty')}
              density="standard"
              mobileLayout="cards"
              rowAction={{
                getHref: (connection) => getConnectionHref(connection.clientId),
                onActivate: (connection) => onOpen(getConnectionHref(connection.clientId)),
                getAccessibleLabel: (connection) => t('openConnection', { name: connection.name }),
              }}
              columns={[
                {
                  key: 'name',
                  header: tCommon('labels.name'),
                  renderCell: (connection) => (
                    <LayoutStack gap="none">
                      <Text weight="medium">{connection.name}</Text>
                      <SupportingText>{connection.publisher ?? t('connections.generatedId')}</SupportingText>
                    </LayoutStack>
                  ),
                },
                {
                  key: 'status',
                  header: tCommon('labels.status'),
                  renderCell: (connection) =>
                    connection.stale ? (
                      <StatusBadge tone="warning">{t('connections.stale')}</StatusBadge>
                    ) : (
                      <StatusBadge tone="positive">{t('connections.active')}</StatusBadge>
                    ),
                },
                {
                  key: 'created',
                  header: tCommon('labels.created'),
                  mobileVisibility: 'hidden',
                  renderCell: (connection) => (connection.createdAt ? <DateTime value={connection.createdAt} /> : null),
                },
                {
                  key: 'actions',
                  header: tCommon('labels.actions'),
                  kind: 'action',
                  align: 'end',
                  renderCell: (connection) => (
                    <TableRowMenu
                      aria-label={t('connectionActions', { name: connection.name })}
                      items={[
                        {
                          label: t('disconnect'),
                          tone: 'danger',
                          onClick: () => onDisconnect(connection),
                        },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </SettingsSection>
        </>
      )}
    </LayoutStack>
  );
}
