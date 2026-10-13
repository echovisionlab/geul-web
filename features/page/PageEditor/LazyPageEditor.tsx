'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const PageEditor = dynamic(() => withQueryClient(import('./PageEditor').then((module) => module.PageEditor)));

type Props = ComponentProps<typeof PageEditor>;

export function LazyPageEditor(props: Props) {
  return <PageEditor {...props} />;
}
