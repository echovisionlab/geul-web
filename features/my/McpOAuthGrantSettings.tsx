'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { ConfirmationDialog } from '@/features/confirmation';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useId, useState } from 'react';

import { IconPlugConnected } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@/components/core/Notification';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';

import { SectionCard, SectionHeader } from '@/components/core/Section';
import type { McpOAuthGrant } from '@/features/auth/hydra-mcp-oauth';
import { revokeMyMcpOAuthGrant } from '@/features/my/mcp-oauth-grant-actions';
import { useLocale } from '@/lib/providers/LocaleProvider';

interface McpOAuthGrantSettingsProps {
  initialGrants: McpOAuthGrant[];
  revokeAction?: typeof revokeMyMcpOAuthGrant;
  initialLoadFailed?: boolean;
}

export function McpOAuthGrantSettings({
  initialGrants,
  initialLoadFailed = false,
  revokeAction = revokeMyMcpOAuthGrant,
}: McpOAuthGrantSettingsProps) {
  const t = useTranslations('security.mcpIntegration');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');
  const locale = useLocale();
  const scopeId = useId();
  const [grants, setGrants] = useState(initialGrants);
  const [selected, setSelected] = useState<McpOAuthGrant | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async () => {
    if (!selected || revokingId !== null) {
      return;
    }
    setRevokingId(selected.id);
    try {
      const result = await revokeAction(selected.id);
      if (!result.success) {
        notifications.show({ tone: 'danger', message: t('revokeFailed') });
        return;
      }
      setGrants((current) => current.filter((grant) => grant.id !== selected.id));
      setSelected(null);
      notifications.show({ tone: 'positive', message: t('revokeSuccess') });
    } catch {
      notifications.show({ tone: 'danger', message: t('revokeFailed') });
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <DsLayoutStack gap="md" data-testid="settings-mcp-oauth-grants">
      <SectionHeader
        title={
          <span role="heading" aria-level={2}>
            {t('connectionsTitle')}
          </span>
        }
        description={t('connectionsDescription')}
      />
      {initialLoadFailed ? (
        <Alert tone="danger">
          <DsText size="sm" tone="secondary">
            {t('loadFailed')}
          </DsText>
        </Alert>
      ) : grants.length === 0 ? (
        <SectionCard appearance="plain">
          <DsLayoutInline gap="sm">
            <IconPlugConnected size={18} aria-hidden />
            <SupportingText tone="secondary">{t('connectionsEmpty')}</SupportingText>
          </DsLayoutInline>
        </SectionCard>
      ) : (
        grants.map((grant) => (
          <SectionCard
            appearance="plain"
            key={grant.id}
            padding="sm"
            data-testid={`settings-mcp-oauth-grant-${grant.id}`}
            role="group"
            aria-labelledby={`${scopeId}-${grant.id}`}
          >
            <DsLayoutInline justify="between" align="center" wrap="wrap">
              <DsLayoutStack gap="xxs">
                <DsText id={`${scopeId}-${grant.id}`} size="sm" weight="medium">
                  {grant.clientName}
                </DsText>
                <DsText size="xs" tone="secondary">
                  {grant.connectedAt
                    ? t('connectedAt', {
                        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                          new Date(grant.connectedAt),
                        ),
                      })
                    : tCommonStates('unknown')}
                </DsText>
              </DsLayoutStack>
              <Button
                size="xs"
                tone="danger"
                emphasis="medium"
                onClick={() => setSelected(grant)}
                disabled={revokingId !== null}
                aria-describedby={`${scopeId}-${grant.id}`}
              >
                {t('revoke')}
              </Button>
            </DsLayoutInline>
          </SectionCard>
        ))
      )}

      <ConfirmationDialog
        intent="revoke"
        opened={selected !== null}
        onClose={() => {
          if (!revokingId) {
            setSelected(null);
          }
        }}
        onConfirm={() => void revoke()}
        title={t('revokeTitle')}
        message={t('revokeConfirmation', { client: selected?.clientName ?? '' })}
        confirmLabel={t('revoke')}
        cancelLabel={tCommonActions('cancel')}
        closeLabel={tCommonActions('close')}
        loading={revokingId !== null}
      />
    </DsLayoutStack>
  );
}
