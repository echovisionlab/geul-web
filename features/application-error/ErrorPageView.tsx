'use client';

import { ErrorPageView as CoreErrorPageView, type ErrorPageViewProps } from '@/components/core/ErrorPage/ErrorPageView';
import { ErrorCodeParticles } from './ErrorCodeParticles';

export function ErrorPageView(props: Omit<ErrorPageViewProps, 'codeVisual'>) {
  return (
    <CoreErrorPageView {...props} codeVisual={props.code ? <ErrorCodeParticles code={props.code} /> : undefined} />
  );
}
