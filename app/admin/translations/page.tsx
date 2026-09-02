'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  type TranslationEntityHealth,
  type TranslationLocaleHealth,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import {
  IconChecklist,
  IconLanguage,
  IconLayersIntersect,
  IconRefresh,
  IconSettings2,
  IconWorld,
} from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { Group, Paper, ScrollArea, SimpleGrid, Stack, Table, Text, Title } from '@mantine/core';
import { type BadgeTone, LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { PageLoader } from '@/features/site/PageLoader';
import { translationOverviewRefetchInterval } from '@/features/translation/translation-job-polling';
import { useTranslationLifecycleSubscription } from '@/features/translation/useTranslationLifecycleSubscription';
import { createTranslationClient } from '@/lib/api/browser-client';
import { getCommonTranslationEntityLabelKey } from '@/lib/translation/entity-type';
import { toDate } from '@/lib/utils/proto';

const overviewQueryKey = ['translation-overview'] as const;

interface StatCardProps {
  title: string;
  value: string;
  icon: typeof IconLanguage;
  color: string;
}

function StatCard({ title, value, icon: Icon, color }: StatCardProps) {
  return (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
            {title}
          </Text>
          <Text fw={700} fz="xl">
            {value}
          </Text>
        </div>
        <Icon size={26} stroke={1.5} color={`var(--mantine-color-${color}-6)`} />
      </Group>
    </Paper>
  );
}

function formatMetricCount(value: number, locale: string) {
  return value.toLocaleString(locale);
}

function getLocalePolicyBadges(
  row: TranslationLocaleHealth,
  t: ReturnType<typeof useTranslations<'translationOverviewPage'>>,
  tCommonLabels: ReturnType<typeof useTranslations<'common.labels'>>,
): Array<{ label: string; tone: BadgeTone }> {
  const badges: Array<{ label: string; tone: BadgeTone }> = [
    {
      label: row.locale?.isPublic ? tCommonLabels('public') : t('policy.internal'),
      tone: row.locale?.isPublic ? 'positive' : 'neutral',
    },
  ];

  if (!row.locale?.machineTranslationAllowed) {
    badges.push({ label: t('policy.machineDisabled'), tone: 'neutral' });
  }

  return badges;
}

export default function TranslationOverviewPage() {
  const t = useTranslations('translationOverviewPage');
  const tCommonActions = useTranslations('common.actions');
  const tCommonEntities = useTranslations('common.entities');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonStatuses = useTranslations('common.statuses');
  const tCommonStates = useTranslations('common.states');
  const locale = useLocale();
  const dateTime = useDateTimeFormatter();
  const formatProtoDateTime = (value: Parameters<typeof toDate>[0]) => {
    const date = toDate(value);
    return date ? dateTime.dateTime(date) : tCommonStates('notAvailable');
  };
  const queryClient = useQueryClient();
  const translationClient = useMemo(() => createTranslationClient(), []);

  const overviewQuery = useQuery({
    queryKey: overviewQueryKey,
    queryFn: async () => translationClient.getTranslationOverview({}),
    refetchInterval: (query) =>
      translationOverviewRefetchInterval(query.state.data?.stats?.activeJobs, query.state.error),
  });

  useTranslationLifecycleSubscription({
    onEvent: async () => {
      await queryClient.invalidateQueries({ queryKey: overviewQueryKey });
    },
  });

  const stats = overviewQuery.data?.stats;
  const entityHealth =
    overviewQuery.data?.entityHealth.filter(
      (row) => row.sourceEntities > 0 || row.existingEntries > 0 || row.activeJobs > 0,
    ) ?? [];

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Title order={2}>{tCommonEntities('translations')}</Title>
        <Group gap="sm">
          <Button
            component={Link}
            href="/admin/translations/jobs"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconChecklist size={16} />}
          >
            {t('actions.openJobs')}
          </Button>
          <Button
            component={Link}
            href="/admin/translations/settings"
            tone="neutral"
            emphasis="medium"
            leftSection={<IconSettings2 size={16} />}
          >
            {t('actions.openSettings')}
          </Button>
          <Button
            emphasis="medium"
            leftSection={<IconRefresh size={16} />}
            onClick={() => queryClient.invalidateQueries({ queryKey: overviewQueryKey })}
            loading={overviewQuery.isFetching}
          >
            {tCommonActions('refresh')}
          </Button>
        </Group>
      </Group>

      {overviewQuery.isLoading ? (
        <PageLoader />
      ) : overviewQuery.isError || !stats ? (
        <Text c="red">{t('states.loadFailed')}</Text>
      ) : (
        <>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <StatCard
              title={t('stats.totalLocales')}
              value={formatMetricCount(stats.totalLocales, locale)}
              icon={IconLanguage}
              color="blue"
            />
            <StatCard
              title={t('stats.sourceEntities')}
              value={formatMetricCount(stats.sourceEntities, locale)}
              icon={IconWorld}
              color="teal"
            />
            <StatCard
              title={t('stats.activeJobs')}
              value={formatMetricCount(stats.activeJobs, locale)}
              icon={IconRefresh}
              color="cyan"
            />
            <StatCard
              title={t('stats.existingEntries')}
              value={formatMetricCount(stats.existingEntries, locale)}
              icon={IconLayersIntersect}
              color="green"
            />
          </SimpleGrid>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>{t('sections.localeHealthTitle')}</Title>
              <ScrollArea>
                <Table striped highlightOnHover withTableBorder horizontalSpacing="md" verticalSpacing="sm" miw={980}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>{tCommonLabels('locale')}</Table.Th>
                      <Table.Th>{t('stats.existingEntries')}</Table.Th>
                      <Table.Th>{tCommonStatuses('inProgress')}</Table.Th>
                      <Table.Th>{t('columns.policy')}</Table.Th>
                      <Table.Th>{t('columns.lastTargetUpdate')}</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {overviewQuery.data?.localeHealth.map((row) => (
                      <Table.Tr key={row.locale?.code ?? 'unknown'}>
                        <Table.Td>
                          <Stack gap={2}>
                            <Text fw={600}>{row.locale?.displayName ?? row.locale?.code ?? 'Unknown'}</Text>
                            <Text size="xs" c="dimmed">
                              {row.locale?.code}
                            </Text>
                          </Stack>
                        </Table.Td>
                        <Table.Td>{formatMetricCount(row.existingEntries, locale)}</Table.Td>
                        <Table.Td>{formatMetricCount(row.activeJobs, locale)}</Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="wrap">
                            {getLocalePolicyBadges(row, t, tCommonLabels).map((badge) => (
                              <LabelBadge
                                key={`${row.locale?.code ?? 'locale'}:${badge.label}`}
                                tone={badge.tone}
                                size="xs"
                              >
                                {badge.label}
                              </LabelBadge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          {row.lastTargetUpdateAt
                            ? formatProtoDateTime(row.lastTargetUpdateAt)
                            : tCommonStates('notAvailable')}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </Stack>
          </Paper>

          <Paper withBorder p="md" radius="md">
            <Stack gap="sm">
              <Title order={4}>{t('sections.entityHealthTitle')}</Title>
              {entityHealth.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t('states.emptyEntityHealth')}
                </Text>
              ) : (
                <ScrollArea>
                  <Table striped highlightOnHover withTableBorder horizontalSpacing="md" verticalSpacing="sm" miw={860}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>{t('columns.entity')}</Table.Th>
                        <Table.Th>{t('columns.sources')}</Table.Th>
                        <Table.Th>{t('stats.existingEntries')}</Table.Th>
                        <Table.Th>{tCommonStatuses('inProgress')}</Table.Th>
                        <Table.Th>{t('columns.lastSourceUpdate')}</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {entityHealth.map((row: TranslationEntityHealth) => (
                        <Table.Tr key={`${row.entityType}:${row.lastSourceUpdateAt?.seconds ?? '0'}`}>
                          <Table.Td>
                            {(() => {
                              const commonEntityKey = getCommonTranslationEntityLabelKey(row.entityType);
                              if (commonEntityKey != null) {
                                return tCommonEntities(commonEntityKey);
                              }
                              return tCommonStates('unknown');
                            })()}
                          </Table.Td>
                          <Table.Td>{formatMetricCount(row.sourceEntities, locale)}</Table.Td>
                          <Table.Td>{formatMetricCount(row.existingEntries, locale)}</Table.Td>
                          <Table.Td>{formatMetricCount(row.activeJobs, locale)}</Table.Td>
                          <Table.Td>
                            {row.lastSourceUpdateAt
                              ? formatProtoDateTime(row.lastSourceUpdateAt)
                              : tCommonStates('notAvailable')}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Paper>
        </>
      )}
    </Stack>
  );
}
