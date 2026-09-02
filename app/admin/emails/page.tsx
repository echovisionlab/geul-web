'use client';

import { IconChartBar, IconDatabaseOff } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Stack, Text, Title } from '@mantine/core';
import { Alert } from '@/components/core/Alert';

export default function AdminEmailsPage() {
  const tPage = useTranslations('adminList.emailEvents');

  return (
    <Stack>
      <Title order={2}>{tPage('title')}</Title>
      <Text size="sm" c="dimmed">
        {tPage('description')}
      </Text>

      <Alert icon={<IconDatabaseOff size={18} />} title={tPage('databaseLogsRemovedTitle')}>
        {tPage('databaseLogsRemovedDescription')}
      </Alert>

      <Alert icon={<IconChartBar size={18} />} title={tPage('dashboardTitle')}>
        {tPage('dashboardDescription')}
      </Alert>
    </Stack>
  );
}
