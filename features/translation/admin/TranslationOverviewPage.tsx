'use client';

import { formatLocaleCode } from '@/components/core/Typography/locale-code';

import { LocaleCode } from '@/components/core/Typography/LocaleCode';
import { SupportingText, Heading as DsHeading, Text as DsText } from '@/components/core/Typography';
import { PageHeader } from '@/components/core/PageHeader';

import { SectionCard as DsSectionCard } from '@/components/core/Section/SectionCard';
import {
  LayoutInline as DsLayoutInline,
  LayoutStack as DsLayoutStack,
  LayoutGrid as DsLayoutGrid,
} from '@/components/core/Layout';

import { useMemo } from 'react';

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
import { StatCard } from '@/components/core/Section';
import { Table } from '@/components/core/Display';
import { type BadgeTone, LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { useDateTimeFormatter } from '@/features/date-time/DateTime';
import { PageLoader } from '@/features/site/PageLoader';
import { translationOverviewRefetchInterval } from '@/features/translation/translation-job-polling';
import { useTranslationLifecycleSubscription } from '@/features/translation/useTranslationLifecycleSubscription';
import { createTranslationClient } from '@/lib/api/browser/secure-translation';
import { getCommonTranslationEntityLabelKey } from '@/lib/translation/entity-type';
import { toDate } from '@/lib/utils/proto';

const overviewQueryKey = ['translation-overview'] as const;

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

export type TranslationOverviewPageClient = Pick<ReturnType<typeof createTranslationClient>, 'getTranslationOverview'>;

export function TranslationOverviewPage({ client }: { client?: TranslationOverviewPageClient } = {}) {
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
  const translationClient = useMemo(() => client ?? createTranslationClient(), [client]);

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
    <DsLayoutStack gap="md">
      <PageHeader
        title={tCommonEntities('translations')}
        actions={
          <DsLayoutInline gap="sm">
            <Button
              href="/admin/translations/jobs"
              tone="neutral"
              emphasis="medium"
              leftSection={<IconChecklist size={16} />}
            >
              {t('actions.openJobs')}
            </Button>
            <Button
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
          </DsLayoutInline>
        }
      />

      {overviewQuery.isLoading ? (
        <PageLoader />
      ) : overviewQuery.isError || !stats ? (
        <DsText role="alert" size="sm" tone="danger">
          {t('states.loadFailed')}
        </DsText>
      ) : (
        <>
          <DsLayoutGrid columns={{ base: 2, md: 4 }}>
            <StatCard
              label={t('stats.totalLocales')}
              value={formatMetricCount(stats.totalLocales, locale)}
              icon={IconLanguage}
            />
            <StatCard
              label={t('stats.sourceEntities')}
              value={formatMetricCount(stats.sourceEntities, locale)}
              icon={IconWorld}
            />
            <StatCard
              label={t('stats.activeJobs')}
              value={formatMetricCount(stats.activeJobs, locale)}
              icon={IconRefresh}
            />
            <StatCard
              label={t('stats.existingEntries')}
              value={formatMetricCount(stats.existingEntries, locale)}
              icon={IconLayersIntersect}
            />
          </DsLayoutGrid>

          <DsSectionCard padding="md">
            <DsLayoutStack gap="sm">
              <DsHeading level={2} scale={4}>
                {t('sections.localeHealthTitle')}
              </DsHeading>
              <Table.ScrollContainer
                minWidth={980}
                role="region"
                aria-label={t('sections.localeHealthTitle')}
                tabIndex={0}
              >
                <Table highlightOnHover density="compact">
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
                          <DsLayoutStack gap="xxs">
                            <DsText size="sm" weight="strong">
                              {row.locale?.displayName ??
                                (row.locale?.code ? formatLocaleCode(row.locale.code) : 'Unknown')}
                            </DsText>
                            {row.locale?.code ? <LocaleCode code={row.locale.code} /> : null}
                          </DsLayoutStack>
                        </Table.Td>
                        <Table.Td>{formatMetricCount(row.existingEntries, locale)}</Table.Td>
                        <Table.Td>{formatMetricCount(row.activeJobs, locale)}</Table.Td>
                        <Table.Td>
                          <DsLayoutInline gap="xxs" wrap="wrap">
                            {getLocalePolicyBadges(row, t, tCommonLabels).map((badge) => (
                              <LabelBadge key={`${row.locale?.code ?? 'locale'}:${badge.label}`} tone={badge.tone}>
                                {badge.label}
                              </LabelBadge>
                            ))}
                          </DsLayoutInline>
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
              </Table.ScrollContainer>
            </DsLayoutStack>
          </DsSectionCard>

          <DsSectionCard padding="md">
            <DsLayoutStack gap="sm">
              <DsHeading level={2} scale={4}>
                {t('sections.entityHealthTitle')}
              </DsHeading>
              {entityHealth.length === 0 ? (
                <SupportingText tone="secondary">{t('states.emptyEntityHealth')}</SupportingText>
              ) : (
                <Table.ScrollContainer
                  minWidth={860}
                  role="region"
                  aria-label={t('sections.entityHealthTitle')}
                  tabIndex={0}
                >
                  <Table highlightOnHover density="compact">
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
                </Table.ScrollContainer>
              )}
            </DsLayoutStack>
          </DsSectionCard>
        </>
      )}
    </DsLayoutStack>
  );
}

export default function Page() {
  return <TranslationOverviewPage />;
}
