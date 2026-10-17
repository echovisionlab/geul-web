'use client';

import { PageHeader } from '@/components/core/PageHeader';
import { LayoutStack as DsLayoutStack, LayoutGrid as DsLayoutGrid } from '@/components/core/Layout';

import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import { IconArticle, IconFileText, IconMessage, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { StatCard } from '@/components/core/Section';
import { PageLoader } from '@/features/site/PageLoader';
import { getAdminStats } from '@/lib/queries/admin-browser';

export default function AdminDashboardPage({ loadStats = getAdminStats }: { loadStats?: typeof getAdminStats }) {
  const t = useTranslations('adminList.dashboard');
  const tCommonLabels = useTranslations('common.labels');
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: loadStats,
  });
  const { data: stats, isLoading } = statsQuery;

  return (
    <DsLayoutStack>
      <QueryErrorAlert queries={[statsQuery]} />
      <PageHeader title={tCommonLabels('dashboard')} />

      {statsQuery.isError ? null : isLoading ? (
        <PageLoader />
      ) : (
        <DsLayoutGrid columns={{ base: 2, md: 4 }}>
          <StatCard
            label={t('stats.totalUsers')}
            value={(stats?.totalUsers ?? 0).toLocaleString()}
            icon={IconUsers}
            href="/admin/users"
            prefetch={false}
          />
          <StatCard
            label={t('stats.totalPosts')}
            value={(stats?.totalPosts ?? 0).toLocaleString()}
            icon={IconArticle}
            href="/admin/posts"
          />
          <StatCard
            label={t('stats.totalPages')}
            value={(stats?.totalPages ?? 0).toLocaleString()}
            icon={IconFileText}
            href="/admin/pages"
          />
          <StatCard
            label={t('stats.totalComments')}
            value={(stats?.totalComments ?? 0).toLocaleString()}
            icon={IconMessage}
          />
        </DsLayoutGrid>
      )}
    </DsLayoutStack>
  );
}
