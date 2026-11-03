'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';

import { LocaleCode } from '@/components/core/Typography/LocaleCode';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { PageHeader } from '@/components/core/PageHeader';

import { LayoutStack as DsLayoutStack, LayoutInline as DsLayoutInline } from '@/components/core/Layout';

import { useEffect, useMemo, useRef } from 'react';

import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconPlayerPause, IconRefresh, IconSettings2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { Table } from '@/components/core/Display';
import { useMounted } from '@mantine/hooks';
import { notifications } from '@/components/core/Notification';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { PageLoader } from '@/features/site/PageLoader';
import {
  filterActiveTranslationJobs,
  translationJobsRefetchInterval,
} from '@/features/translation/translation-job-polling';
import { useTranslationLifecycleSubscription } from '@/features/translation/useTranslationLifecycleSubscription';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { getCommonTranslationEntityLabelKey } from '@/lib/translation/entity-type';
import { getTranslationJobDisplayStatusKey, getTranslationJobDisplayStatusTone } from '@/lib/translation/job-status';
import { toDate } from '@/lib/utils/proto';

const jobsQueryKey = ['translation-jobs'] as const;

export type TranslationJobsPageClient = Pick<
  ReturnType<typeof createTranslationClient>,
  'listTranslationJobs' | 'cancelTranslationJob'
>;

export function TranslationJobsPage({ client }: { client?: TranslationJobsPageClient } = {}) {
  const t = useTranslations('translationJobsPage');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const dateTime = useDateTimeFormatter();
  const hydrated = useMounted();
  const refreshRef = useRef<HTMLButtonElement>(null);
  const cancellationFocus = useRef<{ id: string; element: HTMLElement } | null>(null);
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => client ?? createTranslationClient(), [client]);

  const jobsQuery = useQuery({
    queryKey: jobsQueryKey,
    queryFn: async () => {
      const response = await translationClient.listTranslationJobs({
        pagination: { limit: 100, offset: 0 },
      });
      return { ...response, jobs: filterActiveTranslationJobs(response.jobs) };
    },
    refetchInterval: (query) => translationJobsRefetchInterval(query.state.data?.jobs, query.state.error),
  });

  const cancelJob = useMutation({
    mutationFn: async (jobId: string) => translationClient.cancelTranslationJob({ jobId }),
    onSuccess: async () => {
      notifications.show({ tone: 'positive', message: t('notifications.cancelled') });
      await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
    onError: (error) => {
      cancellationFocus.current = null;
      notifications.show({
        tone: 'danger',
        message: getTranslationActionErrorMessage(error, t('notifications.cancelFailed')),
      });
    },
  });

  useTranslationLifecycleSubscription({
    onEvent: async () => {
      await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
  });

  const jobs = jobsQuery.data?.jobs ?? [];
  const refreshButtonLoading = hydrated ? jobsQuery.isFetching : false;

  useEffect(() => {
    const target = cancellationFocus.current;
    if (!target || jobs.some((job) => job.id === target.id)) {
      return;
    }
    cancellationFocus.current = null;
    const active = target.element.ownerDocument.activeElement;
    if (active === target.element || (!target.element.isConnected && active === target.element.ownerDocument.body)) {
      refreshRef.current?.focus();
    }
  }, [jobs]);

  return (
    <DsLayoutStack gap="md">
      <PageHeader
        title={t('title')}
        actions={
          <DsLayoutInline gap="sm">
            <Button href="/admin/translations" tone="neutral" emphasis="medium">
              {tCommonLabels('overview')}
            </Button>
            <Button
              href="/admin/translations/settings"
              tone="neutral"
              emphasis="medium"
              leftSection={<IconSettings2 size={16} />}
            >
              {tCommonLabels('settings')}
            </Button>
            <Button
              emphasis="medium"
              leftSection={<IconRefresh size={16} />}
              ref={refreshRef}
              onClick={() => queryClient.invalidateQueries({ queryKey: jobsQueryKey })}
              loading={refreshButtonLoading}
            >
              {tCommonActions('refresh')}
            </Button>
          </DsLayoutInline>
        }
      />

      <DsLayoutInline gap="xxs">
        <LabelBadge tone="accent">{t('stats.active', { count: jobs.length })}</LabelBadge>
      </DsLayoutInline>

      {jobsQuery.isLoading ? (
        <PageLoader placement="flow" />
      ) : jobsQuery.error ? (
        <DsText role="alert" size="sm" tone="danger">
          {getTranslationActionErrorMessage(jobsQuery.error, t('states.loadFailed'))}
        </DsText>
      ) : jobs.length === 0 ? (
        <SupportingText role="status" tone="secondary">
          {t('states.empty')}
        </SupportingText>
      ) : (
        <Table.ScrollContainer minWidth={640} role="region" aria-label={t('title')} tabIndex={0}>
          <Table highlightOnHover aria-label={t('title')}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{tCommonLabels('updated')}</Table.Th>
                <Table.Th>{t('columns.entity')}</Table.Th>
                <Table.Th>{tCommonLabels('locale')}</Table.Th>
                <Table.Th>{tCommonLabels('status')}</Table.Th>
                <Table.Th>{tCommonLabels('actions')}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {jobs.map((job) => {
                const updatedAtValue = toDate(job.startedAt ?? job.requestedAt);
                const updatedAt = updatedAtValue ? dateTime.dateTime(updatedAtValue) : '-';
                const commonEntityKey = getCommonTranslationEntityLabelKey(
                  job.target?.entityType ?? TranslationEntityType.UNSPECIFIED,
                );
                const resolvedEntityLabel =
                  commonEntityKey != null ? tCommonEntities(commonEntityKey) : tCommonStates('unknown');
                const statusKey = getTranslationJobDisplayStatusKey(job.status);
                const canCancel = true;

                return (
                  <Table.Tr key={job.id}>
                    <Table.Td>
                      <DsText size="sm" tone="secondary">
                        {updatedAt}
                      </DsText>
                    </Table.Td>
                    <Table.Td>
                      <DsLayoutStack gap="xxs">
                        <DsText size="sm" weight="medium">
                          {resolvedEntityLabel}
                        </DsText>
                        <DsText size="xs" tone="secondary">
                          {job.target?.entityId ?? '-'}
                        </DsText>
                      </DsLayoutStack>
                    </Table.Td>
                    <Table.Td>
                      <DsLayoutInline gap="xxs">
                        <LocaleCode code={job.targetLocale} />
                        <DsText size="xs" tone="secondary">
                          {t('locale.fromTo', {
                            source: formatLocaleCode(job.sourceLocale),
                            target: formatLocaleCode(job.targetLocale),
                          })}
                        </DsText>
                      </DsLayoutInline>
                    </Table.Td>
                    <Table.Td>
                      <StatusBadge tone={getTranslationJobDisplayStatusTone(job.status)}>
                        {statusKey === 'unknown' ? tCommonStates('unknown') : tCommonStatuses(statusKey)}
                      </StatusBadge>
                    </Table.Td>
                    <Table.Td>
                      {canCancel ? (
                        <Button
                          size="xs"
                          tone="danger"
                          emphasis="low"
                          leftSection={<IconPlayerPause size={14} />}
                          aria-label={`${tCommonActions('cancel')} ${resolvedEntityLabel} ${job.target?.entityId ?? job.id} ${formatLocaleCode(job.targetLocale)}`}
                          onClick={(event) => {
                            if (event.currentTarget.ownerDocument.activeElement === event.currentTarget) {
                              cancellationFocus.current = { id: job.id, element: event.currentTarget };
                            }
                            cancelJob.mutate(job.id);
                          }}
                          loading={cancelJob.isPending && cancelJob.variables === job.id}
                        >
                          {tCommonActions('cancel')}
                        </Button>
                      ) : null}
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </DsLayoutStack>
  );
}

export default function Page() {
  return <TranslationJobsPage />;
}
