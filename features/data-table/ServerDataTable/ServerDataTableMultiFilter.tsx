'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';

import type { ServerDataTableMultiFilterProps } from './ServerDataTableMultiFilterRuntime';

export type { ServerDataTableMultiFilterProps, FilterFieldConfig } from './ServerDataTableMultiFilterRuntime';

function ToolbarLoading() {
  const t = useTranslations('dataTable.filter');
  return <IconButton size="xs" emphasis="low" loading aria-label={t('button')} />;
}

const ServerDataTableMultiFilterRuntime = dynamic(
  () => import('./ServerDataTableMultiFilterRuntime').then((module) => module.ServerDataTableMultiFilter),
  { loading: ToolbarLoading },
);

export function ServerDataTableMultiFilter(props: ServerDataTableMultiFilterProps) {
  return <ServerDataTableMultiFilterRuntime {...props} />;
}
