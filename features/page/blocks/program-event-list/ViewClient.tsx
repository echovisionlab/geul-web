'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { ProgramEventListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ProgramEventListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function ProgramEventListViewClient(props: ProgramEventListViewClientProps) {
  return <RuntimeView {...props} />;
}
