'use client';

import dynamic from 'next/dynamic';
import type { LabelListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.LabelListViewClient));

export function LabelListViewClient(props: LabelListViewClientProps) {
  return <RuntimeView {...props} />;
}
