'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { IconPlayerPause, IconRefresh, IconSettings2 } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Stack, Table, Text, Title } from '@mantine/core';
import { useMounted } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { LabelBadge, StatusBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { PageLoader } from '@/features/site/PageLoader';
import {
  filterActiveTranslationJobs,
  translationJobsRefetchInterval,
} from '@/features/translation/translation-job-polling';
import { useTranslationLifecycleSubscription } from '@/features/translation/useTranslationLifecycleSubscription';
import { createTranslationClient } from '@/lib/api/browser-client';
import { getTranslationActionErrorMessage } from '@/lib/translation/action-error';
import { getCommonTranslationEntityLabelKey } from '@/lib/translation/entity-type';
import { getTranslationJobDisplayStatusKey, getTranslationJobDisplayStatusTone } from '@/lib/translation/job-status';
import { toDate } from '@/lib/utils/proto';

const jobsQueryKey = ['translation-jobs'] as const;

export default function TranslationJobsPage() {
  const t = useTranslations('translationJobsPage');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const dateTime = useDateTimeFormatter();
  const hydrated = useMounted();
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => createTranslationClient(), []);

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
      notifications.show({ color: 'green', message: t('notifications.cancelled') });
      await queryClient.invalidateQueries({ queryKey: jobsQueryKey });
    },
    onError: (error) => {
      notifications.show({
        color: 'red',
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

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{t('title')}</Title>
        <Group gap="sm">
          <Button component={Link} href="/admin/translations" tone="neutral" emphasis="medium">
            {tCommonLabels('overview')}
          </Button>
          <Button
            component={Link}
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
            onClick={() => queryClient.invalidateQueries({ queryKey: jobsQueryKey })}
            loading={refreshButtonLoading}
          >
            {tCommonActions('refresh')}
          </Button>
        </Group>
      </Group>

      <LabelBadge tone="accent">{t('stats.active', { count: jobs.length })}</LabelBadge>

      {jobsQuery.isLoading ? (
        <PageLoader />
      ) : jobsQuery.error ? (
        <Text c="red">{getTranslationActionErrorMessage(jobsQuery.error, t('states.loadFailed'))}</Text>
      ) : jobs.length === 0 ? (
        <Text c="dimmed">{t('states.empty')}</Text>
      ) : (
        <Table highlightOnHover>
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
                    <Text size="sm" c="dimmed">
                      {updatedAt}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={500}>
                        {resolvedEntityLabel}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {job.target?.entityId ?? '-'}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm">{job.targetLocale}</Text>
                      <Text size="xs" c="dimmed">
                        {t('locale.fromTo', { source: job.sourceLocale, target: job.targetLocale })}
                      </Text>
                    </Group>
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
                        onClick={() => cancelJob.mutate(job.id)}
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
      )}
    </Stack>
  );
}
