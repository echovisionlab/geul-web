'use client';

import dynamic from 'next/dynamic';
import type { PostListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.PostListViewClient));

export function PostListViewClient(props: PostListViewClientProps) {
  return <RuntimeView {...props} />;
}
