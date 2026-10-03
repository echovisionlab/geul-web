'use client';

import dynamic from 'next/dynamic';
import type { ServerDataTableMultiSortProps } from './ServerDataTableMultiSortRuntime';

export type { ServerDataTableMultiSortProps, SortFieldConfig } from './ServerDataTableMultiSortRuntime';

const ServerDataTableMultiSortRuntime = dynamic(() =>
  import('./ServerDataTableMultiSortRuntime').then((module) => module.ServerDataTableMultiSort),
);

export function ServerDataTableMultiSort(props: ServerDataTableMultiSortProps) {
  return <ServerDataTableMultiSortRuntime {...props} />;
}
