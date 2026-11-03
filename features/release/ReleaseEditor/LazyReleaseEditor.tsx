'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader/PageLoader';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ReleaseEditor = dynamic(() => withQueryClient(import('./ReleaseEditor').then((module) => module.ReleaseEditor)), {
  loading: () => <PageLoader placement="flow" />,
});

type Props = ComponentProps<typeof ReleaseEditor>;

export function LazyReleaseEditor(props: Props) {
  return <ReleaseEditor {...props} />;
}
