'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader/PageLoader';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { ComponentProps } from 'react';

const ProgramEventEditor = dynamic(
  () => withQueryClient(import('./ProgramEventEditor').then((module) => module.ProgramEventEditor)),
  { loading: () => <PageLoader placement="flow" /> },
);

type Props = ComponentProps<typeof ProgramEventEditor>;

export function LazyProgramEventEditor(props: Props) {
  return <ProgramEventEditor {...props} />;
}
