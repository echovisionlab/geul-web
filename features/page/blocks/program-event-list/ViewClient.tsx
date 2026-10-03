'use client';

import dynamic from 'next/dynamic';
import type { ProgramEventListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ProgramEventListViewClient));

export function ProgramEventListViewClient(props: ProgramEventListViewClientProps) {
  return <RuntimeView {...props} />;
}
