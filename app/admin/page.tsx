'use client';

import Link from 'next/link';
import { IconArticle, IconFileText, IconMessage, IconUsers } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { PageLoader } from '@/features/site/PageLoader';
import { getAdminStats } from '@/lib/queries/admin-browser';

interface StatCardProps {
  title: string;
  value: number;
  icon: typeof IconUsers;
  color: string;
  href?: string;
  prefetch?: boolean;
}

function StatCard({ title, value, icon: Icon, color, href, prefetch }: StatCardProps) {
  const content = (
    <Paper withBorder p="md" radius="md">
      <Group justify="space-between">
        <div>
          <Text c="dimmed" tt="uppercase" fw={700} fz="xs">
            {title}
          </Text>
          <Text fw={700} fz="xl">
            {value.toLocaleString()}
          </Text>
        </div>
        <Icon size={28} stroke={1.5} color={`var(--mantine-color-${color}-6)`} />
      </Group>
    </Paper>
  );

  if (href) {
    return (
      <Link href={href} prefetch={prefetch} style={{ textDecoration: 'none' }}>
        {content}
      </Link>
    );
  }

  return content;
}

export default function AdminDashboardPage() {
  const t = useTranslations('adminList.dashboard');
  const tCommonLabels = useTranslations('common.labels');
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getAdminStats,
  });

  return (
    <Stack>
      <Title order={2}>{tCommonLabels('dashboard')}</Title>

      {isLoading ? (
        <PageLoader />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
          <StatCard
            title={t('stats.totalUsers')}
            value={stats?.totalUsers ?? 0}
            icon={IconUsers}
            color="blue"
            href="/admin/users"
            prefetch={false}
          />
          <StatCard
            title={t('stats.totalPosts')}
            value={stats?.totalPosts ?? 0}
            icon={IconArticle}
            color="teal"
            href="/admin/posts"
          />
          <StatCard
            title={t('stats.totalPages')}
            value={stats?.totalPages ?? 0}
            icon={IconFileText}
            color="violet"
            href="/admin/pages"
          />
          <StatCard
            title={t('stats.totalComments')}
            value={stats?.totalComments ?? 0}
            icon={IconMessage}
            color="orange"
          />
        </SimpleGrid>
      )}
    </Stack>
  );
}
