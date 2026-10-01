'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const ProgramEventEditor = dynamic(() => import('./ProgramEventEditor').then((module) => module.ProgramEventEditor));

type Props = ComponentProps<typeof ProgramEventEditor>;

export function LazyProgramEventEditor(props: Props) {
  return <ProgramEventEditor {...props} />;
}
