'use client';

import dynamic from 'next/dynamic';
import type { ComponentProps } from 'react';

const PrivacyEditor = dynamic(() => import('./PrivacyEditor').then((module) => module.PrivacyEditor));

type Props = ComponentProps<typeof PrivacyEditor>;

export function LazyPrivacyEditor(props: Props) {
  return <PrivacyEditor {...props} />;
}
