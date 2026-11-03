'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const PageEditor = dynamic(() => withQueryClient(import('./PageEditor').then((module) => module.PageEditor)), {
  loading: () => <PageLoader placement="flow" />,
});

type Props = ComponentProps<typeof PageEditor>;

export function LazyPageEditor(props: Props) {
  return <PageEditor {...props} />;
}
