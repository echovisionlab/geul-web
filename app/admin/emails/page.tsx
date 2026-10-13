'use client';
import { SupportingText, Heading as DsHeading } from '@/components/core/Typography';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';

import { IconChartBar, IconDatabaseOff } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Alert } from '@/components/core/Alert';

export default function AdminEmailsPage() {
  const tPage = useTranslations('adminList.emailEvents');

  return (
    <DsLayoutStack>
      <DsHeading level={2}>{tPage('title')}</DsHeading>
      <SupportingText tone="secondary">{tPage('description')}</SupportingText>

      <Alert icon={<IconDatabaseOff size={18} />} title={tPage('databaseLogsRemovedTitle')}>
        {tPage('databaseLogsRemovedDescription')}
      </Alert>

      <Alert icon={<IconChartBar size={18} />} title={tPage('dashboardTitle')}>
        {tPage('dashboardDescription')}
      </Alert>
    </DsLayoutStack>
  );
}
