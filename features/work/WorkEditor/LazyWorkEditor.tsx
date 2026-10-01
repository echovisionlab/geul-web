'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const WorkEditor = dynamic(() => import('./WorkEditor').then((module) => module.WorkEditor));

type Props = ComponentProps<typeof WorkEditor>;

export function LazyWorkEditor(props: Props) {
  return <WorkEditor {...props} />;
}
