'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ProgramEventEditor = dynamic(() =>
  withQueryClient(import('./ProgramEventEditor').then((module) => module.ProgramEventEditor)),
);

type Props = ComponentProps<typeof ProgramEventEditor>;

export function LazyProgramEventEditor(props: Props) {
  return <ProgramEventEditor {...props} />;
}
