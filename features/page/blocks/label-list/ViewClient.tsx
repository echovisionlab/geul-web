'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { LabelListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.LabelListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function LabelListViewClient(props: LabelListViewClientProps) {
  return <RuntimeView {...props} />;
}
