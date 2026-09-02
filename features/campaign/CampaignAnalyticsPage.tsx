'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  IconArrowLeft,
  IconBan,
  IconCheck,
  IconMailOff,
  IconPlayerSkipForward,
  IconShieldOff,
  IconUsers,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Pagination, Progress, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import { getCampaignAction, getCampaignRecipientsAction, getCampaignStatsAction } from '@/lib/actions/campaign';
import { guardNotFound } from '@/lib/utils/not-found-guard';

function getRecipientBadgeColor(status: string): string {
  switch (status) {
    case 'sent':
      return 'green';
    case 'queued':
    case 'rendering':
    case 'sending':
      return 'blue';
    case 'permanent_failed':
    case 'transient_failed':
    case 'blocked':
      return 'red';
    case 'suppressed':
      return 'orange';
    case 'skipped':
      return 'gray';
    default:
      return 'gray';
  }
}

const RECIPIENTS_PAGE_SIZE = 50;

export default function CampaignAnalyticsPage() {
  const params = useParams();
  const router = useRouter();
  const dateTime = useDateTimeFormatter();
  const t = useTranslations('campaignAnalytics');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tCampaignStatuses = useTranslations('adminList.campaigns.statuses');
  const campaignId = params.id as string;
  const [recipientPage, setRecipientPage] = useState(1);

  function getRecipientStatusLabel(status: string): string {
    switch (status) {
      case 'sent':
        return t('recipientStatuses.sent');
      case 'queued':
        return t('recipientStatuses.queued');
      case 'rendering':
        return t('recipientStatuses.rendering');
      case 'sending':
        return t('recipientStatuses.sending');
      case 'skipped':
        return t('recipientStatuses.skipped');
      case 'transient_failed':
        return t('recipientStatuses.transientFailed');
      case 'permanent_failed':
        return t('recipientStatuses.permanentFailed');
      case 'blocked':
        return t('recipientStatuses.blocked');
      case 'suppressed':
        return t('recipientStatuses.suppressed');
      default:
        return status;
    }
  }

  function formatDate(date?: Date): string {
    return date ? dateTime.dateTime(date) : '-';
  }

  const { data: campaign, isLoading: isLoadingCampaign } = useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: () => getCampaignAction(campaignId),
  });

  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['campaigns', 'stats', campaignId],
    queryFn: () => getCampaignStatsAction(campaignId),
  });

  const { data: recipientResult, isLoading: isLoadingRecipients } = useQuery({
    queryKey: ['campaigns', 'recipients', campaignId, recipientPage],
    queryFn: () =>
      getCampaignRecipientsAction(campaignId, RECIPIENTS_PAGE_SIZE, (recipientPage - 1) * RECIPIENTS_PAGE_SIZE),
  });

  const isLoading = isLoadingCampaign || isLoadingStats || isLoadingRecipients;

  if (isLoading) {
    return <PageLoader />;
  }

  guardNotFound(campaign);

  const recipients = recipientResult?.recipients ?? [];
  const totalRecipients =
    recipientResult?.total ??
    (stats ? stats.totalSent + stats.totalSkipped + stats.totalFailed + stats.totalBlocked + stats.totalSuppressed : 0);
  const percent = (count: number) => (totalRecipients > 0 ? (count / totalRecipients) * 100 : 0);
  const recipientPageCount = Math.max(1, Math.ceil(totalRecipients / RECIPIENTS_PAGE_SIZE));
  const sortedRecipients = [...recipients].sort(
    (a, b) => new Date(b.terminalAt ?? b.sentAt ?? 0).getTime() - new Date(a.terminalAt ?? a.sentAt ?? 0).getTime(),
  );

  return (
    <Stack>
      <Group>
        <Tooltip label={t('actions.backToCampaign')}>
          <IconButton
            emphasis="low"
            aria-label={t('actions.backToCampaign')}
            onClick={() => router.push(`/campaigns/${campaignId}?edit=true`)}
          >
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <Title order={2}>{t('title')}</Title>
        <StatusBadge tone={campaign.status === 'sent' ? 'positive' : 'neutral'}>
          {tCampaignStatuses(campaign.status)}
        </StatusBadge>
      </Group>

      <Text size="lg" fw={500}>
        {campaign.name || campaign.subject || tCommonStates('noSubject')}
      </Text>

      <Text size="sm" c="dimmed">
        {campaign.subject || tCommonStates('noSubject')}
      </Text>

      {campaign.sentAt && (
        <Text size="sm" c="dimmed">
          {t('sentAt', {
            date: dateTime.date(campaign.sentAt),
            time: dateTime.time(campaign.sentAt),
          })}
        </Text>
      )}

      <SimpleGrid cols={{ base: 2, sm: 6 }}>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconUsers size={20} />
            <Text size="sm" c="dimmed">
              {tCommonLabels('recipients')}
            </Text>
          </Group>
          <Text size="xl" fw={700}>
            {totalRecipients}
          </Text>
        </SectionCard>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconCheck size={20} color="green" />
            <Text size="sm" c="dimmed">
              {t('stats.sent')}
            </Text>
          </Group>
          <Text size="xl" fw={700} c="green">
            {stats?.totalSent || 0}
          </Text>
        </SectionCard>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconMailOff size={20} color="red" />
            <Text size="sm" c="dimmed">
              {t('stats.failed')}
            </Text>
          </Group>
          <Text size="xl" fw={700} c="red">
            {stats?.totalFailed || 0}
          </Text>
        </SectionCard>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconBan size={20} color="red" />
            <Text size="sm" c="dimmed">
              {t('stats.blocked')}
            </Text>
          </Group>
          <Text size="xl" fw={700} c="red">
            {stats?.totalBlocked || 0}
          </Text>
        </SectionCard>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconShieldOff size={20} color="orange" />
            <Text size="sm" c="dimmed">
              {t('stats.suppressed')}
            </Text>
          </Group>
          <Text size="xl" fw={700} c="orange">
            {stats?.totalSuppressed || 0}
          </Text>
        </SectionCard>
        <SectionCard withBorder p="md">
          <Group gap="xs">
            <IconPlayerSkipForward size={20} />
            <Text size="sm" c="dimmed">
              {t('stats.skipped')}
            </Text>
          </Group>
          <Text size="xl" fw={700} c="dimmed">
            {stats?.totalSkipped || 0}
          </Text>
        </SectionCard>
      </SimpleGrid>

      {totalRecipients > 0 && (
        <SectionCard withBorder p="md">
          <Text size="sm" fw={500} mb="xs">
            {t('deliveryStatus')}
          </Text>
          <Progress.Root size="xl">
            <Tooltip label={t('tooltips.sent', { count: stats?.totalSent || 0 })}>
              <Progress.Section value={percent(stats?.totalSent || 0)} color="green">
                <Progress.Label>{percent(stats?.totalSent || 0).toFixed(0)}%</Progress.Label>
              </Progress.Section>
            </Tooltip>
            <Tooltip label={t('tooltips.failed', { count: stats?.totalFailed || 0 })}>
              <Progress.Section value={percent(stats?.totalFailed || 0)} color="red">
                {percent(stats?.totalFailed || 0) > 5 ? (
                  <Progress.Label>{percent(stats?.totalFailed || 0).toFixed(0)}%</Progress.Label>
                ) : null}
              </Progress.Section>
            </Tooltip>
            <Tooltip label={t('tooltips.blocked', { count: stats?.totalBlocked || 0 })}>
              <Progress.Section value={percent(stats?.totalBlocked || 0)} color="red" />
            </Tooltip>
            <Tooltip label={t('tooltips.suppressed', { count: stats?.totalSuppressed || 0 })}>
              <Progress.Section value={percent(stats?.totalSuppressed || 0)} color="orange" />
            </Tooltip>
            <Tooltip label={t('tooltips.skipped', { count: stats?.totalSkipped || 0 })}>
              <Progress.Section value={percent(stats?.totalSkipped || 0)} color="gray">
                {percent(stats?.totalSkipped || 0) > 5 ? (
                  <Progress.Label>{percent(stats?.totalSkipped || 0).toFixed(0)}%</Progress.Label>
                ) : null}
              </Progress.Section>
            </Tooltip>
          </Progress.Root>
        </SectionCard>
      )}

      <Title order={4}>{tCommonLabels('recipients')}</Title>

      {sortedRecipients.length === 0 ? (
        <Text c="dimmed">{t('empty')}</Text>
      ) : (
        <Table highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{tCommonLabels('email')}</Table.Th>
              <Table.Th>{tCommonLabels('status')}</Table.Th>
              <Table.Th>{tCommonLabels('time')}</Table.Th>
              <Table.Th>{tCommonLabels('details')}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRecipients.map((recipient) => (
              <Table.Tr key={recipient.email}>
                <Table.Td>
                  <Text size="sm">{recipient.email}</Text>
                </Table.Td>
                <Table.Td>
                  <StatusBadge tone={statusToneFromColor(getRecipientBadgeColor(recipient.status))} size="sm">
                    {getRecipientStatusLabel(recipient.status)}
                  </StatusBadge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" c="dimmed">
                    {formatDate(recipient.terminalAt ?? recipient.sentAt)}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {recipient.errorType ? (
                    <Text size="xs" c="red" lineClamp={1}>
                      {recipient.errorType}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed">
                      -
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {recipientPageCount > 1 ? (
        <Group justify="center">
          <Pagination value={recipientPage} total={recipientPageCount} onChange={setRecipientPage} />
        </Group>
      ) : null}
    </Stack>
  );
}
