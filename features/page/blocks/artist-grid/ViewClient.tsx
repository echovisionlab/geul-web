'use client';

import dynamic from 'next/dynamic';
import type { ArtistListViewClientProps } from './ViewClientRuntime';

const RuntimeView = dynamic(() => import('./ViewClientRuntime').then((module) => module.ArtistListViewClient));

export function ArtistListViewClient(props: ArtistListViewClientProps) {
  return <RuntimeView {...props} />;
}
