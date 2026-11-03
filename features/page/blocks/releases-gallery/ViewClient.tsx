'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { ReleaseListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ReleaseListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function ReleaseListViewClient(props: ReleaseListViewClientProps) {
  return <RuntimeView {...props} />;
}
