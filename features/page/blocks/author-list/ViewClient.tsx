'use client';

import dynamic from 'next/dynamic';
import type { AuthorListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.AuthorListViewClient));

export function AuthorListViewClient(props: AuthorListViewClientProps) {
  return <RuntimeView {...props} />;
}
