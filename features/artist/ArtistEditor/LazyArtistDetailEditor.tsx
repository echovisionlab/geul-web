'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const ArtistDetailEditor = dynamic(() => import('./ArtistDetailEditor').then((module) => module.ArtistDetailEditor));

type Props = ComponentProps<typeof ArtistDetailEditor>;

export function LazyArtistDetailEditor(props: Props) {
  return <ArtistDetailEditor {...props} />;
}
