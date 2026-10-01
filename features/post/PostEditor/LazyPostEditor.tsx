'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const PostEditor = dynamic(() => import('./PostEditor').then((module) => module.PostEditor));

type Props = ComponentProps<typeof PostEditor>;

export function LazyPostEditor(props: Props) {
  return <PostEditor {...props} />;
}
