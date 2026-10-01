'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const PageEditor = dynamic(() => import('./PageEditor').then((module) => module.PageEditor));

type Props = ComponentProps<typeof PageEditor>;

export function LazyPageEditor(props: Props) {
  return <PageEditor {...props} />;
}
