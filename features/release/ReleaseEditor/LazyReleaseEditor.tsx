'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const ReleaseEditor = dynamic(() => import('./ReleaseEditor').then((module) => module.ReleaseEditor));

type Props = ComponentProps<typeof ReleaseEditor>;

export function LazyReleaseEditor(props: Props) {
  return <ReleaseEditor {...props} />;
}
