'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/core/Alert';
import { ExecutableRuntimeStatus } from '@/features/executable/ExecutableRuntimeControls';
import {
  createShaderPreviewWorkerRuntime,
  shaderContainedSize,
  type ShaderPreviewRuntime,
  type ShaderPreviewRuntimeFactory,
  type ShaderAssetResolver,
} from './shader-preview-runtime';
import type { ShaderError } from './shader-source';
import type { ShaderProgramDocument } from './shader-program';
import classes from './ShaderNode.module.css';

export interface ShaderPreviewLabels {
  title?: string;
  preview: string;
  running: string;
  stopped: string;
  error: string;
}

const DEFAULT_PREVIEW_LABELS: ShaderPreviewLabels = {
  preview: 'Preview',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
};

function previewHeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(720, Math.max(180, Math.round(parsed))) : 360;
}

export function ShaderPreviewSurface({
  program,
  resolveAsset,
  height,
  revision,
  active,
  runtimeFactory,
  labels,
  onRuntime,
  onError,
  onPointer,
  onResize,
}: {
  program: ShaderProgramDocument;
  resolveAsset?: ShaderAssetResolver;
  height: number;
  revision: number;
  active: boolean;
  runtimeFactory: ShaderPreviewRuntimeFactory;
  labels: ShaderPreviewLabels;
  onRuntime: (runtime: ShaderPreviewRuntime | null) => void;
  onError: (error: ShaderError | null) => void;
  onPointer: (x: number, y: number, pressed: boolean) => void;
  onResize: (width: number, height: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runSource = useRef(program);
  runSource.current = program;
  const onRuntimeRef = useRef(onRuntime);
  const onErrorRef = useRef(onError);
  const onPointerRef = useRef(onPointer);
  const onResizeRef = useRef(onResize);
  onRuntimeRef.current = onRuntime;
  onErrorRef.current = onError;
  onPointerRef.current = onPointer;
  onResizeRef.current = onResize;
  const [visible, setVisible] = useState(false);
  const [canvasGeneration, setCanvasGeneration] = useState(0);
  const visibleRef = useRef(false);
  const [status, setStatus] = useState<'starting' | 'running' | 'stopped' | 'error'>(active ? 'starting' : 'stopped');
  const [error, setError] = useState<ShaderError | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const hiddenByTree = () => Boolean(canvas.closest('[aria-hidden="true"], [hidden]'));
    const updateVisibility = () => {
      const nextVisible = !document.hidden && !hiddenByTree();
      if (nextVisible && !visibleRef.current) {
        setCanvasGeneration((value) => value + 1);
      }
      visibleRef.current = nextVisible;
      setVisible(nextVisible);
    };
    updateVisibility();
    const onVisibility = updateVisibility;
    document.addEventListener('visibilitychange', onVisibility);
    const mutation = new MutationObserver(onVisibility);
    mutation.observe(document.documentElement, {
      attributes: true,
      subtree: true,
      attributeFilter: ['aria-hidden', 'hidden', 'style', 'class'],
    });
    return () => {
      mutation.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [revision, canvasGeneration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !visible || !canvas) {
      setStatus('stopped');
      return;
    }
    setStatus('starting');
    setError(null);
    onErrorRef.current(null);
    const runtime = runtimeFactory(canvas, {
      onReady: () => setStatus('running'),
      onStopped: () => setStatus('stopped'),
      onError: (nextError) => {
        setError(nextError);
        onErrorRef.current(nextError);
        setStatus('error');
      },
    });
    onRuntimeRef.current(runtime);
    if (resolveAsset) {
      runtime.run(runSource.current, { resolveAsset });
    } else {
      runtime.run(runSource.current);
    }
    return () => {
      onRuntimeRef.current(null);
      runtime.dispose();
    };
  }, [active, resolveAsset, revision, runtimeFactory, visible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver !== 'function') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const bounds = entry?.contentRect;
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
        return;
      }
      const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
      const contained = shaderContainedSize(bounds.width * pixelRatio, bounds.height * pixelRatio);
      onResizeRef.current(contained.width, contained.height);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [revision, canvasGeneration]);

  const sendPointer = useCallback((event: React.PointerEvent<HTMLCanvasElement>, pressed: boolean) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * canvas.width;
    const y = (1 - (event.clientY - bounds.top) / Math.max(1, bounds.height)) * canvas.height;
    onPointerRef.current(x, y, pressed);
  }, []);

  return (
    <div
      className={classes.preview}
      data-testid="shader-preview"
      data-status={status}
      data-preview-height={height}
      style={{ height }}
    >
      <canvas
        key={`${revision}:${canvasGeneration}`}
        ref={canvasRef}
        className={classes.canvas}
        width={960}
        height={540}
        aria-label={labels.preview}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          sendPointer(event, true);
        }}
        onPointerMove={(event) => sendPointer(event, event.buttons !== 0)}
        onPointerUp={(event) => {
          sendPointer(event, false);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onPointerCancel={(event) => {
          sendPointer(event, false);
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
      />
      <ExecutableRuntimeStatus status={status} running={labels.running} stopped={labels.stopped} />
      {error ? (
        <Alert className={classes.error} tone="danger" title={labels.error} data-testid="shader-error">
          {error.message}
          {error.line ? ` (${error.line}:${error.column ?? 1})` : ''}
        </Alert>
      ) : null}
    </div>
  );
}

/** Public adapter with no Tiptap, ProseMirror or Yjs dependency. */
export function ShaderPublicPreview({
  program,
  audioEnabled = false,
  resolveAsset,
  height = 360,
  labels: providedLabels,
  runtimeFactory = createShaderPreviewWorkerRuntime,
  active: controlledActive,
  revision: controlledRevision,
  onRuntime,
  onError,
  onRunningChange,
}: {
  program: ShaderProgramDocument;
  audioEnabled?: boolean;
  resolveAsset?: ShaderAssetResolver;
  height?: number;
  labels?: Partial<ShaderPreviewLabels>;
  runtimeFactory?: ShaderPreviewRuntimeFactory;
  active?: boolean;
  revision?: number;
  onRuntime?: (runtime: ShaderPreviewRuntime | null) => void;
  onError?: (error: ShaderError | null) => void;
  onRunningChange?: (running: boolean) => void;
}) {
  const labels = useMemo(() => ({ ...DEFAULT_PREVIEW_LABELS, ...providedLabels }), [providedLabels]);
  const runtimeRef = useRef<ShaderPreviewRuntime | null>(null);
  const previousAudioEnabled = useRef(false);
  const onRuntimeRef = useRef(onRuntime);
  const onErrorRef = useRef(onError);
  const onRunningChangeRef = useRef(onRunningChange);
  onRuntimeRef.current = onRuntime;
  onErrorRef.current = onError;
  onRunningChangeRef.current = onRunningChange;
  const programKey = JSON.stringify(program);
  const previousSource = useRef(programKey);
  const [internalRevision, setInternalRevision] = useState(1);
  const [internalRunning, setInternalRunning] = useState(true);
  const active = controlledActive ?? internalRunning;
  const revision = controlledRevision ?? internalRevision;
  const setRuntime = useCallback((runtime: ShaderPreviewRuntime | null) => {
    runtimeRef.current = runtime;
    onRuntimeRef.current?.(runtime);
  }, []);
  const handleError = useCallback(
    (error: ShaderError | null) => {
      onErrorRef.current?.(error);
      if (error && controlledActive === undefined) {
        setInternalRunning(false);
      }
      if (error) {
        onRunningChangeRef.current?.(false);
      }
    },
    [controlledActive],
  );
  const pointer = useCallback(
    (x: number, y: number, pressed: boolean) => runtimeRef.current?.pointer(x, y, pressed),
    [],
  );
  const resize = useCallback((width: number, nextHeight: number) => runtimeRef.current?.resize(width, nextHeight), []);
  useEffect(() => {
    if (audioEnabled && !previousAudioEnabled.current) {
      runtimeRef.current?.enableAudio();
    }
    previousAudioEnabled.current = audioEnabled;
  }, [audioEnabled]);
  useEffect(() => {
    if (previousSource.current === programKey) {
      return;
    }
    previousSource.current = programKey;
    if (!active || controlledRevision !== undefined) {
      return;
    }
    const timer = setTimeout(() => {
      onErrorRef.current?.(null);
      setInternalRevision((value) => value + 1);
    }, 250);
    return () => clearTimeout(timer);
  }, [active, controlledRevision, programKey]);
  return (
    <ShaderPreviewSurface
      program={program}
      resolveAsset={resolveAsset}
      height={previewHeight(height)}
      revision={revision}
      active={active}
      runtimeFactory={runtimeFactory}
      labels={labels}
      onRuntime={setRuntime}
      onError={handleError}
      onPointer={pointer}
      onResize={resize}
    />
  );
}
