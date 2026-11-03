'use client';

import { PageLoader } from '@/features/site/PageLoader';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const PrivacyEditor = dynamic(() => import('./PrivacyEditor').then((module) => module.PrivacyEditor), {
  loading: () => <PageLoader placement="flow" />,
});

type Props = ComponentProps<typeof PrivacyEditor>;

export function LazyPrivacyEditor(props: Props) {
  return <PrivacyEditor {...props} />;
}
