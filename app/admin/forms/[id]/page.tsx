'use client';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';
import { unwrapQueryResult } from '@/lib/api/query-result';

import { useParams } from 'next/navigation';
import { IconCalendar, IconCalendarMonth, IconCalendarWeek, IconChartBar } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { SimpleGrid, Stack } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';
import { StatCard } from '@/components/core/Section';
import { getFormSubmissionStatsAction } from '@/lib/actions/form';

export default function AdminFormOverviewPage() {
  const t = useTranslations('formAdmin.overview');
  const tCommonTimeRanges = useTranslations('common.timeRanges');
  const params = useParams();
  const formId = params.id as string;

  const statsQuery = useQuery({
    queryKey: ['forms', 'stats', formId],
    queryFn: () => getFormSubmissionStatsAction(formId).then(unwrapQueryResult),
  });
  const { data: stats, isLoading } = statsQuery;

  if (statsQuery.isError && statsQuery.data === undefined) {
    return <QueryErrorAlert queries={[statsQuery]} />;
  }
  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <Stack>
      <QueryErrorAlert queries={[statsQuery]} />
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
        <StatCard
          label={t('totalSubmissions')}
          value={(stats?.totalSubmissions ?? 0).toLocaleString()}
          icon={<IconChartBar size={20} />}
        />
        <StatCard
          label={tCommonTimeRanges('today')}
          value={(stats?.submissionsToday ?? 0).toLocaleString()}
          icon={<IconCalendar size={20} />}
        />
        <StatCard
          label={tCommonTimeRanges('thisWeek')}
          value={(stats?.submissionsThisWeek ?? 0).toLocaleString()}
          icon={<IconCalendarWeek size={20} />}
        />
        <StatCard
          label={tCommonTimeRanges('thisMonth')}
          value={(stats?.submissionsThisMonth ?? 0).toLocaleString()}
          icon={<IconCalendarMonth size={20} />}
        />
      </SimpleGrid>
    </Stack>
  );
}
