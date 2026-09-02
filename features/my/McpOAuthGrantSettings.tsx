'use client';

import { useState } from 'react';
import { Group, Stack, Text } from '@mantine/core';
import { IconPlugConnected } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { notifications } from '@mantine/notifications';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { ConfirmModal } from '@/components/core/Modal';
import { SectionCard, SectionHeader } from '@/components/core/Section';
import type { McpOAuthGrant } from '@/features/auth/hydra-mcp-oauth';
import { revokeMyMcpOAuthGrant } from '@/features/my/mcp-oauth-grant-actions';
import { useLocale } from '@/lib/providers/LocaleProvider';

interface McpOAuthGrantSettingsProps {
  initialGrants: McpOAuthGrant[];
  initialLoadFailed?: boolean;
}

export function McpOAuthGrantSettings({ initialGrants, initialLoadFailed = false }: McpOAuthGrantSettingsProps) {
  const t = useTranslations('security.mcpIntegration');
  const tCommonActions = useTranslations('common.actions');
  const tCommonStates = useTranslations('common.states');
  const locale = useLocale();
  const [grants, setGrants] = useState(initialGrants);
  const [selected, setSelected] = useState<McpOAuthGrant | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const revoke = async () => {
    if (!selected) {
      return;
    }
    setRevokingId(selected.id);
    const result = await revokeMyMcpOAuthGrant(selected.id);
    setRevokingId(null);
    if (!result.success) {
      notifications.show({ color: 'red', message: t('revokeFailed') });
      return;
    }
    setGrants((current) => current.filter((grant) => grant.id !== selected.id));
    setSelected(null);
    notifications.show({ color: 'green', message: t('revokeSuccess') });
  };

  return (
    <Stack gap="sm" data-testid="settings-mcp-oauth-grants">
      <SectionHeader title={t('connectionsTitle')} description={t('connectionsDescription')} />
      {initialLoadFailed ? (
        <Alert tone="danger">
          <Text size="sm">{t('loadFailed')}</Text>
        </Alert>
      ) : grants.length === 0 ? (
        <SectionCard>
          <Group gap="sm">
            <IconPlugConnected size={18} aria-hidden />
            <Text size="sm" c="dimmed">
              {t('connectionsEmpty')}
            </Text>
          </Group>
        </SectionCard>
      ) : (
        grants.map((grant) => (
          <SectionCard key={grant.id} p="sm" data-testid={`settings-mcp-oauth-grant-${grant.id}`}>
            <Group justify="space-between" align="center" wrap="wrap">
              <Stack gap={2}>
                <Text size="sm" fw={500}>
                  {grant.clientName}
                </Text>
                <Text size="xs" c="dimmed">
                  {grant.connectedAt
                    ? t('connectedAt', {
                        date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                          new Date(grant.connectedAt),
                        ),
                      })
                    : tCommonStates('unknown')}
                </Text>
              </Stack>
              <Button
                size="xs"
                tone="danger"
                emphasis="outline"
                onClick={() => setSelected(grant)}
                disabled={revokingId !== null}
              >
                {t('revoke')}
              </Button>
            </Group>
          </SectionCard>
        ))
      )}

      <ConfirmModal
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
        confirmTone="danger"
        loading={revokingId !== null}
      />
    </Stack>
  );
}
