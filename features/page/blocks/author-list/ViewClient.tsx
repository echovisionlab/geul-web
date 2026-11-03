'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { AuthorListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.AuthorListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function AuthorListViewClient(props: AuthorListViewClientProps) {
  return <RuntimeView {...props} />;
}
