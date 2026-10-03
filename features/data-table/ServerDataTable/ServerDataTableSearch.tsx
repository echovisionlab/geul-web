'use client';

import dynamic from 'next/dynamic';
import type { ServerDataTableSearchProps } from './ServerDataTableSearchRuntime';

export type { ServerDataTableSearchProps } from './ServerDataTableSearchRuntime';

const ServerDataTableSearchRuntime = dynamic(() =>
  import('./ServerDataTableSearchRuntime').then((module) => module.ServerDataTableSearch),
);

export function ServerDataTableSearch(props: ServerDataTableSearchProps) {
  return <ServerDataTableSearchRuntime {...props} />;
}
