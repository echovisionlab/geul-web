'use client';

import dynamic from 'next/dynamic';
import type { WorkListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.WorkListViewClient));

export function WorkListViewClient(props: WorkListViewClientProps) {
  return <RuntimeView {...props} />;
}
