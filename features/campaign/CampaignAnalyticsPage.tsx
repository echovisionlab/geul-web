'use client';
import { SupportingText, Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import {
  LayoutStack as DsLayoutStack,
  LayoutInline as DsLayoutInline,
  LayoutGrid as DsLayoutGrid,
  LayoutInset as DsLayoutInset,
} from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

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
import { SegmentedProgress } from '@/components/core/Progress';
import { Pagination, Table } from '@/components/core/Display';
import { StatusBadge, type StatusTone } from '@/components/core/Badge';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { IconButton } from '@/components/core/IconButton';
import { PageLoader } from '@/features/site/PageLoader';
import { SectionCard, StatCard } from '@/components/core/Section';
import { Tooltip } from '@/components/core/Tooltip';
import { getCampaignAction, getCampaignRecipientsAction, getCampaignStatsAction } from '@/lib/actions/campaign';
import { guardNotFound } from '@/lib/utils/not-found-guard';

function getRecipientStatusTone(status: string): StatusTone {
  switch (status) {
    case 'sent':
      return 'positive';
    case 'queued':
    case 'rendering':
    case 'sending':
      return 'accent';
    case 'permanent_failed':
    case 'transient_failed':
    case 'blocked':
      return 'danger';
    case 'suppressed':
      return 'warning';
    case 'skipped':
      return 'neutral';
    default:
      return 'neutral';
  }
}

const CAMPAIGN_STATUS_TONES: Record<string, StatusTone> = {
  draft: 'neutral',
  scheduled: 'accent',
  sending: 'accent',
  sent: 'positive',
  failed: 'danger',
};

const RECIPIENTS_PAGE_SIZE = 50;

export interface CampaignAnalyticsBindings {
  getCampaign: typeof getCampaignAction;
  getStats: typeof getCampaignStatsAction;
  getRecipients: typeof getCampaignRecipientsAction;
}
const defaultBindings: CampaignAnalyticsBindings = {
  getCampaign: getCampaignAction,
  getStats: getCampaignStatsAction,
  getRecipients: getCampaignRecipientsAction,
};
export default function CampaignAnalyticsPage({
  bindings = defaultBindings,
  id,
}: { bindings?: CampaignAnalyticsBindings; id?: string } = {}) {
  const tPagination = useTranslations('dataTable.pagination');
  const params = useParams();
  const router = useRouter();
  const dateTime = useDateTimeFormatter();
  const t = useTranslations('campaignAnalytics');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStates = useTranslations('common.states');
  const tCampaignStatuses = useTranslations('adminList.campaigns.statuses');
  const campaignId = id ?? (params.id as string);
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

  const campaignQuery = useQuery({
    queryKey: ['campaigns', campaignId],
    queryFn: () => bindings.getCampaign(campaignId).then(unwrapQueryResult),
  });
  const { data: campaign, isLoading: isLoadingCampaign } = campaignQuery;

  const statsQuery = useQuery({
    queryKey: ['campaigns', 'stats', campaignId],
    queryFn: () => bindings.getStats(campaignId).then(unwrapQueryResult),
  });
  const { data: stats, isLoading: isLoadingStats } = statsQuery;

  const recipientsQuery = useQuery({
    queryKey: ['campaigns', 'recipients', campaignId, recipientPage],
    queryFn: () =>
      bindings
        .getRecipients(campaignId, RECIPIENTS_PAGE_SIZE, (recipientPage - 1) * RECIPIENTS_PAGE_SIZE)
        .then(unwrapQueryResult),
  });
  const { data: recipientResult, isLoading: isLoadingRecipients } = recipientsQuery;

  const isLoading = isLoadingCampaign || isLoadingStats || isLoadingRecipients;

  if (isLoading) {
    return <PageLoader />;
  }

  if (
    (campaignQuery.isError && !campaign) ||
    (statsQuery.isError && !stats) ||
    (recipientsQuery.isError && !recipientResult)
  ) {
    return <QueryErrorAlert queries={[campaignQuery, statsQuery, recipientsQuery]} />;
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
    <DsLayoutStack>
      <QueryErrorAlert queries={[campaignQuery, statsQuery, recipientsQuery]} />
      <DsLayoutInline>
        <Tooltip label={t('actions.backToCampaign')}>
          <IconButton
            emphasis="low"
            aria-label={t('actions.backToCampaign')}
            onClick={() => router.push(`/campaigns/${campaignId}?edit=true`)}
          >
            <IconArrowLeft size={20} />
          </IconButton>
        </Tooltip>
        <DsHeading level={2}>{t('title')}</DsHeading>
        <StatusBadge tone={CAMPAIGN_STATUS_TONES[campaign.status] ?? 'neutral'}>
          {tCampaignStatuses(campaign.status)}
        </StatusBadge>
      </DsLayoutInline>

      <DsText size="lg" weight="medium">
        {campaign.name || campaign.subject || tCommonStates('noSubject')}
      </DsText>

      <DsText size="sm" tone="secondary">
        {campaign.subject || tCommonStates('noSubject')}
      </DsText>

      {campaign.sentAt && (
        <DsText size="sm" tone="secondary">
          {t('sentAt', {
            date: dateTime.date(campaign.sentAt),
            time: dateTime.time(campaign.sentAt),
          })}
        </DsText>
      )}

      <DsLayoutGrid columns={{ base: 2, md: 3, lg: 6 }}>
        <StatCard label={tCommonLabels('recipients')} value={totalRecipients} icon={IconUsers} />
        <StatCard label={t('stats.sent')} value={stats?.totalSent || 0} icon={IconCheck} tone="positive" />
        <StatCard label={t('stats.failed')} value={stats?.totalFailed || 0} icon={IconMailOff} tone="danger" />
        <StatCard label={t('stats.blocked')} value={stats?.totalBlocked || 0} icon={IconBan} tone="danger" />
        <StatCard
          label={t('stats.suppressed')}
          value={stats?.totalSuppressed || 0}
          icon={IconShieldOff}
          tone="warning"
        />
        <StatCard
          label={t('stats.skipped')}
          value={stats?.totalSkipped || 0}
          icon={IconPlayerSkipForward}
          tone="neutral"
        />
      </DsLayoutGrid>

      {totalRecipients > 0 && (
        <SectionCard padding="md">
          <DsLayoutInset blockEnd="xs">
            <DsText size="sm" weight="medium">
              {t('deliveryStatus')}
            </DsText>
          </DsLayoutInset>
          <SegmentedProgress
            label={t('deliveryStatus')}
            segments={[
              {
                id: 'sent',
                value: percent(stats?.totalSent || 0),
                tone: 'positive',
                label: t('tooltips.sent', { count: stats?.totalSent || 0 }),
              },
              {
                id: 'failed',
                value: percent(stats?.totalFailed || 0),
                tone: 'danger',
                label: t('tooltips.failed', { count: stats?.totalFailed || 0 }),
              },
              {
                id: 'blocked',
                value: percent(stats?.totalBlocked || 0),
                tone: 'danger',
                label: t('tooltips.blocked', { count: stats?.totalBlocked || 0 }),
              },
              {
                id: 'suppressed',
                value: percent(stats?.totalSuppressed || 0),
                tone: 'warning',
                label: t('tooltips.suppressed', { count: stats?.totalSuppressed || 0 }),
              },
              {
                id: 'skipped',
                value: percent(stats?.totalSkipped || 0),
                tone: 'neutral',
                label: t('tooltips.skipped', { count: stats?.totalSkipped || 0 }),
              },
            ]}
          />
        </SectionCard>
      )}

      <DsHeading level={3} scale={4}>
        {tCommonLabels('recipients')}
      </DsHeading>

      {sortedRecipients.length === 0 ? (
        <SupportingText role="status" tone="secondary">
          {t('empty')}
        </SupportingText>
      ) : (
        <Table.ScrollContainer minWidth={640} role="region" aria-label={tCommonLabels('email')} tabIndex={0}>
          <Table highlightOnHover aria-label={tCommonLabels('recipients')}>
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
                    <DsText size="sm">{recipient.email}</DsText>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge tone={getRecipientStatusTone(recipient.status)} size="sm">
                      {getRecipientStatusLabel(recipient.status)}
                    </StatusBadge>
                  </Table.Td>
                  <Table.Td>
                    <DsText size="sm" tone="secondary">
                      {formatDate(recipient.terminalAt ?? recipient.sentAt)}
                    </DsText>
                  </Table.Td>
                  <Table.Td>
                    {recipient.errorType ? (
                      <DsText size="sm" tone="danger" lines={1}>
                        {recipient.errorType}
                      </DsText>
                    ) : (
                      <DsText size="sm" tone="secondary">
                        -
                      </DsText>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {recipientPageCount > 1 ? (
        <DsLayoutInline justify="center">
          <Pagination
            value={recipientPage}
            total={recipientPageCount}
            onChange={setRecipientPage}
            labels={{
              previousPage: tPagination('previousPage'),
              nextPage: tPagination('nextPage'),
              page: (page) => tPagination('page', { page }),
            }}
          />
        </DsLayoutInline>
      ) : null}
    </DsLayoutStack>
  );
}
