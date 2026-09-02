'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { ExecutableRuntimeStatus } from '@/features/executable/ExecutableRuntimeControls';
import type { P5Capability } from './p5-capabilities';
import type { P5SketchLabels } from './p5-node-options';
import type { P5PreviewRuntime, P5PreviewRuntimeFactory } from './p5-preview-runtime';
import type { P5SketchError } from './p5-source';
import classes from './P5SketchNode.module.css';

export interface P5PreviewSurfaceProps {
  source: string;
  height: number;
  revision: number;
  active: boolean;
  runtimeFactory: P5PreviewRuntimeFactory;
  labels: P5SketchLabels;
  onRuntime: (runtime: P5PreviewRuntime | null) => void;
  capabilities: readonly P5Capability[];
  onInactive: () => void;
}

function formatError(error: P5SketchError): string {
  const location = error.line ? ` (${error.line}:${error.column ?? 1})` : '';
  return `${error.message}${location}`;
}

export function P5PreviewSurface({
  source,
  height,
  revision,
  active,
  runtimeFactory,
  labels,
  onRuntime,
  capabilities,
  onInactive,
}: P5PreviewSurfaceProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const runSource = useRef(source);
  const [status, setStatus] = useState<'starting' | 'running' | 'stopped' | 'error'>(active ? 'starting' : 'stopped');
  const [error, setError] = useState<P5SketchError | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!active || !mount) {
      setStatus('stopped');
      return;
    }
    setStatus('starting');
    setError(null);
    const runtime = runtimeFactory(mount, {
      onReady: () => setStatus('running'),
      onStopped: () => {
        setStatus('stopped');
        onInactive();
      },
      onError: (nextError) => {
        setError(nextError);
        setStatus('error');
        onInactive();
      },
    });
    onRuntime(runtime);
    runtime.run(runSource.current, capabilities.length > 0 ? { capabilities } : undefined);
    return () => {
      onRuntime(null);
      runtime.dispose();
    };
  }, [active, capabilities, onInactive, onRuntime, revision, runtimeFactory]);

  return (
    <div className={classes.preview} data-testid="p5-preview" data-status={status} style={{ height }}>
      <div ref={mountRef} className={classes.runtime} aria-label={labels.preview} />
      <ExecutableRuntimeStatus status={status} running={labels.running} stopped={labels.stopped} />
      {error ? (
        <Alert className={classes.error} tone="danger" title={labels.error} data-testid="p5-error">
          {formatError(error)}
        </Alert>
      ) : null}
    </div>
  );
}
