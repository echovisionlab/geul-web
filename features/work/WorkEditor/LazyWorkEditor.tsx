'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const WorkEditor = dynamic(() => withQueryClient(import('./WorkEditor').then((module) => module.WorkEditor)));

type Props = ComponentProps<typeof WorkEditor>;

export function LazyWorkEditor(props: Props) {
  return <WorkEditor {...props} />;
}
