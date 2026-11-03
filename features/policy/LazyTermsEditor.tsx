'use client';

import { PageLoader } from '@/features/site/PageLoader';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const TermsEditor = dynamic(() => import('./TermsEditor').then((module) => module.TermsEditor), {
  loading: () => <PageLoader placement="flow" />,
});

type Props = ComponentProps<typeof TermsEditor>;

export function LazyTermsEditor(props: Props) {
  return <TermsEditor {...props} />;
}
