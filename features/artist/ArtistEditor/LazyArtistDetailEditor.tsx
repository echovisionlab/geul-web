'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ArtistDetailEditor = dynamic(() =>
  withQueryClient(import('./ArtistDetailEditor').then((module) => module.ArtistDetailEditor)),
);

type Props = ComponentProps<typeof ArtistDetailEditor>;

export function LazyArtistDetailEditor(props: Props) {
  return <ArtistDetailEditor {...props} />;
}
