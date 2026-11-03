'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { ComponentProps } from 'react';

const PostEditor = dynamic(() => import('./PostEditor').then((module) => module.PostEditor), {
  loading: () => <PageLoader placement="flow" />,
});

type Props = ComponentProps<typeof PostEditor>;

export function LazyPostEditor(props: Props) {
  return <PostEditor {...props} />;
}
