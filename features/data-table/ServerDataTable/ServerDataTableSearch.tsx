'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { SearchInput } from '@/components/core/Input/SearchInput';

import type { ServerDataTableSearchProps } from './ServerDataTableSearchRuntime';

export type { ServerDataTableSearchProps } from './ServerDataTableSearchRuntime';

function ToolbarLoading() {
  const t = useTranslations('common.placeholders');
  return <SearchInput disabled aria-busy="true" aria-label={t('search')} placeholder={t('search')} />;
}

const ServerDataTableSearchRuntime = dynamic(
  () => import('./ServerDataTableSearchRuntime').then((module) => module.ServerDataTableSearch),
  { loading: ToolbarLoading },
);

export function ServerDataTableSearch(props: ServerDataTableSearchProps) {
  return <ServerDataTableSearchRuntime {...props} />;
}
