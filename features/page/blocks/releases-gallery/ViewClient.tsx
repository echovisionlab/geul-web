'use client';

import dynamic from 'next/dynamic';
import type { ReleaseListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ReleaseListViewClient));

export function ReleaseListViewClient(props: ReleaseListViewClientProps) {
  return <RuntimeView {...props} />;
}
