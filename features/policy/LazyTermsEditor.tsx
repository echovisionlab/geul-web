'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const TermsEditor = dynamic(() => import('./TermsEditor').then((module) => module.TermsEditor));

type Props = ComponentProps<typeof TermsEditor>;

export function LazyTermsEditor(props: Props) {
  return <TermsEditor {...props} />;
}
