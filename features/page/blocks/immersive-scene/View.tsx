'use client';

import dynamic from 'next/dynamic';
import { PageLoader } from '@/features/site/PageLoader';
import type { BlockViewProps } from '../types';

// Keep unused block implementations out of the public page's initial client graph.
// SSR stays enabled so rendered sections retain their HTML and chunk preloads.
const RuntimeView = dynamic(() => import('./ViewRuntime').then((module) => module.ImmersiveSceneView), {
  loading: () => <PageLoader placement="flow" />,
});

export function ImmersiveSceneView(props: BlockViewProps) {
  return <RuntimeView {...props} />;
}
