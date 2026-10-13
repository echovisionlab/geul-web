'use client';

import dynamic from 'next/dynamic';
import { withQueryClient } from '@/lib/providers/with-query-client';
import type { BlockViewProps } from '../types';

// Keep unused block implementations out of the public page's initial client graph.
// SSR stays enabled so rendered sections retain their HTML and chunk preloads.
const RuntimeView = dynamic(() => withQueryClient(import('./ViewRuntime').then((module) => module.FormView)));

export function FormView(props: BlockViewProps & { preview?: boolean }) {
  return <RuntimeView {...props} />;
}
