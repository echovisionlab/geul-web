'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ReleaseEditor = dynamic(() => withQueryClient(import('./ReleaseEditor').then((module) => module.ReleaseEditor)));

type Props = ComponentProps<typeof ReleaseEditor>;

export function LazyReleaseEditor(props: Props) {
  return <ReleaseEditor {...props} />;
}
