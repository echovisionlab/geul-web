'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { ArtistListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ArtistListViewClient), {
  loading: () => <PageLoader placement="flow" />,
});

export function ArtistListViewClient(props: ArtistListViewClientProps) {
  return <RuntimeView {...props} />;
}
