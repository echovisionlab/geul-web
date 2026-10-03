'use client';

import type { BlockViewProps } from '../types';
import { useOptionalContentBlockMediaRuntime } from '@/features/media/ContentBlockMediaRuntimeContext';
import { ImmersiveSceneRenderer } from './SceneRenderer';
import { hydrateImmersiveSceneRuntimeProps } from './runtime-media';
import { parseImmersiveSceneConfig } from './schema';

export function ImmersiveSceneView({ sectionId, props }: BlockViewProps) {
  const runtime = useOptionalContentBlockMediaRuntime();
  const runtimeProps = hydrateImmersiveSceneRuntimeProps(props, sectionId, runtime);
  const config = parseImmersiveSceneConfig(runtimeProps);
  return <ImmersiveSceneRenderer config={config} />;
}
