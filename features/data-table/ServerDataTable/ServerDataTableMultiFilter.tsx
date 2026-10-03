'use client';

import dynamic from 'next/dynamic';
import type { ServerDataTableMultiFilterProps } from './ServerDataTableMultiFilterRuntime';

export type { ServerDataTableMultiFilterProps, FilterFieldConfig } from './ServerDataTableMultiFilterRuntime';

const ServerDataTableMultiFilterRuntime = dynamic(() =>
  import('./ServerDataTableMultiFilterRuntime').then((module) => module.ServerDataTableMultiFilter),
);

export function ServerDataTableMultiFilter(props: ServerDataTableMultiFilterProps) {
  return <ServerDataTableMultiFilterRuntime {...props} />;
}
