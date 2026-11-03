'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader/PageLoader';
import type { ComponentProps } from 'react';

const ProgramEventSeriesEditor = dynamic(
  () => import('./ProgramEventSeriesEditor').then((module) => module.ProgramEventSeriesEditor),
  { loading: () => <PageLoader placement="flow" /> },
);

type Props = ComponentProps<typeof ProgramEventSeriesEditor>;

export function LazyProgramEventSeriesEditor(props: Props) {
  return <ProgramEventSeriesEditor {...props} />;
}
