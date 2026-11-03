'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { IconButton } from '@/components/core/IconButton';

import type { ServerDataTableMultiSortProps } from './ServerDataTableMultiSortRuntime';

export type { ServerDataTableMultiSortProps, SortFieldConfig } from './ServerDataTableMultiSortRuntime';

function ToolbarLoading() {
  const t = useTranslations('dataTable.sort');
  return <IconButton size="xs" emphasis="low" loading aria-label={t('button')} />;
}

const ServerDataTableMultiSortRuntime = dynamic(
  () => import('./ServerDataTableMultiSortRuntime').then((module) => module.ServerDataTableMultiSort),
  { loading: ToolbarLoading },
);

export function ServerDataTableMultiSort(props: ServerDataTableMultiSortProps) {
  return <ServerDataTableMultiSortRuntime {...props} />;
}
