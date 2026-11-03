'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader/PageLoader';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ArtistDetailEditor = dynamic(
  () => withQueryClient(import('./ArtistDetailEditor').then((module) => module.ArtistDetailEditor)),
  { loading: () => <PageLoader placement="flow" /> },
);

type Props = ComponentProps<typeof ArtistDetailEditor>;

export function LazyArtistDetailEditor(props: Props) {
  return <ArtistDetailEditor {...props} />;
}
