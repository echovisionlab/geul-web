'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const ProgramEventSeriesEditor = dynamic(() =>
  import('./ProgramEventSeriesEditor').then((module) => module.ProgramEventSeriesEditor),
);

type Props = ComponentProps<typeof ProgramEventSeriesEditor>;

export function LazyProgramEventSeriesEditor(props: Props) {
  return <ProgramEventSeriesEditor {...props} />;
}
