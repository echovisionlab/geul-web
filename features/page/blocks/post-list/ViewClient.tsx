'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { PostListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.PostListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function PostListViewClient(props: PostListViewClientProps) {
  return <RuntimeView {...props} />;
}
