import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Group, Stack, Text, Title } from '@mantine/core';
import { statusToneFromColor, StatusBadge } from '@/components/core/Badge';
import { ContentCard } from '@/components/core/Section';
import { listMySeries } from '@/lib/queries/series';

const STATUS_COLORS: Record<string, string> = {
  draft: 'yellow',
  published: 'green',
};

export default async function MySeriesPage() {
  const t = await getTranslations('series');
  const tCommon = await getTranslations('common');
  const tCommonEntities = await getTranslations('common.entities');
  const items = await listMySeries();

  return (
    <Stack>
      <Title order={2}>{tCommonEntities('series')}</Title>

      {items.length === 0 ? (
        <Text c="dimmed" size="sm">
          {t('empty')}
        </Text>
      ) : (
        <Stack gap="sm">
          {items.map((series) => (
            <Link key={series.id} href={`/my/series/${series.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
              <ContentCard withBorder>
                <Group justify="space-between" align="flex-start">
                  <Stack gap={2}>
                    <Text fw={600}>{series.title}</Text>
                    {series.slug && (
                      <Text size="xs" c="dimmed">
                        /{series.slug}
                      </Text>
                    )}
                  </Stack>
                  <StatusBadge tone={statusToneFromColor(STATUS_COLORS[series.status] ?? 'gray')}>
                    {tCommon(`statuses.${series.status}`)}
                  </StatusBadge>
                </Group>
                <Group gap="md" mt="sm">
                  <Text size="sm" c="dimmed">
                    {t('stats.posts', { count: series.postCount })}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {t('stats.managers', { count: series.managerCount })}
                  </Text>
                </Group>
              </ContentCard>
            </Link>
          ))}
        </Stack>
      )}
    </Stack>
  );
}
