'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { WorkListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.WorkListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function WorkListViewClient(props: WorkListViewClientProps) {
  return <RuntimeView {...props} />;
}
