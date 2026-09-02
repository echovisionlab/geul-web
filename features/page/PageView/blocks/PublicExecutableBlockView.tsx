'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Group, Stack } from '@mantine/core';
import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { Button } from '@/components/core/Button';
import { MonacoSourceEditor, type SourceEditorLanguage } from '@/features/editor/tiptap/code-editor';
import { PrintCodeSource } from '@/features/editor/tiptap/code/PrintCodeSource';
import {
  ExecutableBlockTitle,
  ExecutableRuntimeControls,
  ExecutableRuntimeStatus,
} from '@/features/executable/ExecutableRuntimeControls';
import { normalizeP5Capabilities, type P5Capability } from '@/features/editor/tiptap/p5/p5-capabilities';
import { P5CapabilityControl } from '@/features/editor/tiptap/p5/P5CapabilityControl';
import {
  createP5PreviewRuntime,
  type P5PreviewRuntime,
  type P5PreviewRuntimeFactory,
} from '@/features/editor/tiptap/p5/p5-preview-runtime';
import { ShaderPublicPreview } from '@/features/editor/tiptap/shader/ShaderPublicPreview';
import { ShaderAvailableInputs } from '@/features/editor/tiptap/shader/ShaderApiReference';
import { installShaderInputMonacoApi } from '@/features/editor/tiptap/shader/shader-editor-api';
import {
  SHADER_STAGE_DEFINITIONS,
  type ShaderChannelStage,
  type ShaderProgramDocument,
  type ShaderStage,
} from '@/features/editor/tiptap/shader/shader-program';
import {
  createShaderPreviewWorkerRuntime,
  type ShaderAssetResolver,
  type ShaderPreviewRuntime,
  type ShaderPreviewRuntimeFactory,
} from '@/features/editor/tiptap/shader/shader-preview-runtime';
import {
  createThreePreviewWorkerRuntime,
  type ThreePreviewRuntime,
  type ThreePreviewRuntimeFactory,
} from '@/features/editor/tiptap/three/three-preview-runtime';
import classes from './PublicExecutableBlockView.module.css';

export type PublicExecutableBlockType = 'p5Sketch' | 'threeScene' | 'shader';
type PublicExecutableMode = 'edit' | 'source' | 'preview';
type PublicExecutableRuntime = P5PreviewRuntime | ThreePreviewRuntime | ShaderPreviewRuntime;
type PublicExecutableError = { message: string; line?: number; column?: number };

export interface PublicExecutableRuntimeFactories {
  p5Sketch: P5PreviewRuntimeFactory;
  threeScene: ThreePreviewRuntimeFactory;
  shader: ShaderPreviewRuntimeFactory;
}

const DEFAULT_RUNTIME_FACTORIES: PublicExecutableRuntimeFactories = {
  p5Sketch: createP5PreviewRuntime,
  threeScene: createThreePreviewWorkerRuntime,
  shader: createShaderPreviewWorkerRuntime,
};

interface PublicExecutableLabels {
  title: string;
  edit: string;
  source: string;
  preview: string;
  run: string;
  stop: string;
  restart: string;
  apply: string;
  copy: string;
  copied: string;
  resetOriginal: string;
  sourceInput: string;
  running: string;
  stopped: string;
  error: string;
  availableInputs: string;
  apiHint: string;
  sharedStage: string;
  capabilities: string;
  capabilitiesDescription: string;
  suggestedByCode: string;
  unsupportedCapability: string;
  capabilityLabels: Record<P5Capability, string>;
}

interface PublicExecutableBlockViewBaseProps {
  blockId: string;
  title?: string;
  previewHeight: number;
  style?: CSSProperties;
  runtimeFactories?: Partial<PublicExecutableRuntimeFactories>;
}

export type PublicExecutableBlockViewProps = PublicExecutableBlockViewBaseProps &
  (
    | {
        type: 'shader';
        language: 'glsl';
        program: ShaderProgramDocument;
        resolveAsset?: ShaderAssetResolver;
      }
    | {
        type: 'p5Sketch';
        language: SourceEditorLanguage;
        source: string;
        capabilities?: readonly P5Capability[];
      }
    | {
        type: 'threeScene';
        language: SourceEditorLanguage;
        source: string;
      }
  );

interface PublicExecutableSources {
  source: string;
  shaderProgram: ShaderProgramDocument | null;
}

function updateShaderSource(
  sources: PublicExecutableSources,
  stage: ShaderStage,
  value: string,
): PublicExecutableSources {
  if (!sources.shaderProgram) {
    return sources;
  }
  return {
    ...sources,
    shaderProgram: {
      ...sources.shaderProgram,
      sources: { ...sources.shaderProgram.sources, [stage]: value },
    },
  };
}

function shaderMarkdown(program: ShaderProgramDocument | null): string {
  if (!program) {
    return '';
  }
  return SHADER_STAGE_DEFINITIONS.flatMap(([stage, , filename]) => {
    const source = program.sources[stage];
    return source ? [`### ${filename}\n\n\`\`\`glsl\n${source}\n\`\`\``] : [];
  }).join('\n\n');
}

function normalizePreviewHeight(value: number): number {
  return Number.isFinite(value) ? Math.min(720, Math.max(180, Math.round(value))) : 360;
}

function formatError(error: PublicExecutableError): string {
  return `${error.message}${error.line ? ` (${error.line}:${error.column ?? 1})` : ''}`;
}

function createRuntime(
  type: PublicExecutableBlockType,
  mount: HTMLDivElement | null,
  canvas: HTMLCanvasElement | null,
  factories: PublicExecutableRuntimeFactories,
  events: {
    onReady: () => void;
    onStopped: () => void;
    onError: (error: PublicExecutableError) => void;
  },
  capabilities: readonly P5Capability[],
): P5PreviewRuntime | ThreePreviewRuntime | null {
  if (type === 'p5Sketch') {
    if (!mount) {
      return null;
    }
    const runtime = factories.p5Sketch(mount, events);
    return {
      ...runtime,
      run: (source: string) => (capabilities.length > 0 ? runtime.run(source, { capabilities }) : runtime.run(source)),
    };
  }
  if (type === 'threeScene') {
    return canvas ? factories.threeScene(canvas, events) : null;
  }
  return null;
}

function RuntimeSurface({
  active,
  audioEnabled,
  factories,
  height,
  revision,
  sources,
  type,
  labels,
  onError,
  onRuntime,
  capabilities,
  onInactive,
  resolveAsset,
}: {
  active: boolean;
  audioEnabled: boolean;
  factories: PublicExecutableRuntimeFactories;
  height: number;
  revision: number;
  sources: PublicExecutableSources;
  type: PublicExecutableBlockType;
  labels: PublicExecutableLabels;
  onError: (error: PublicExecutableError | null) => void;
  onRuntime: (runtime: PublicExecutableRuntime | null) => void;
  resolveAsset?: ShaderAssetResolver;
  capabilities: readonly P5Capability[];
  onInactive: () => void;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageVisible, setPageVisible] = useState(true);
  const [status, setStatus] = useState<'starting' | 'running' | 'stopped' | 'error'>(active ? 'starting' : 'stopped');

  useEffect(() => {
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => document.removeEventListener('visibilitychange', updateVisibility);
  }, []);

  useEffect(() => {
    if (!pageVisible && capabilities.length > 0) {
      onInactive();
    }
  }, [capabilities, onInactive, pageVisible]);

  useEffect(() => {
    if (type === 'shader') {
      return;
    }
    if (!active || !pageVisible) {
      setStatus('stopped');
      return;
    }
    setStatus('starting');
    onError(null);
    const runtime = createRuntime(
      type,
      mountRef.current,
      canvasRef.current,
      factories,
      {
        onReady: () => setStatus('running'),
        onStopped: () => {
          setStatus('stopped');
          onInactive();
        },
        onError: (nextError) => {
          setStatus('error');
          onError(nextError);
        },
      },
      capabilities,
    );
    if (!runtime) {
      return;
    }
    onRuntime(runtime);
    runtime.run(sources.source);
    return () => {
      onRuntime(null);
      runtime.dispose();
    };
  }, [active, capabilities, factories, onError, onInactive, onRuntime, pageVisible, revision, sources.source, type]);

  return (
    <div
      className={classes.preview}
      data-runtime-surface={type}
      {...(type === 'shader' ? {} : { 'data-status': status })}
    >
      {type === 'p5Sketch' ? (
        <div ref={mountRef} className={classes.runtime} aria-label={labels.preview} style={{ height }} />
      ) : type === 'shader' ? (
        active ? (
          <ShaderPublicPreview
            program={sources.shaderProgram!}
            height={height}
            runtimeFactory={factories.shader}
            active={active}
            audioEnabled={audioEnabled}
            revision={revision}
            onRuntime={onRuntime}
            onError={onError}
            resolveAsset={resolveAsset}
            labels={{
              title: labels.title,
              preview: labels.preview,
              running: labels.running,
              stopped: labels.stopped,
              error: labels.error,
            }}
          />
        ) : null
      ) : (
        <canvas
          key={revision}
          ref={canvasRef}
          className={classes.canvas}
          width={960}
          height={height * 2}
          style={{ height }}
          aria-label={labels.preview}
        />
      )}
      {type === 'shader' ? null : (
        <ExecutableRuntimeStatus status={status} running={labels.running} stopped={labels.stopped} />
      )}
    </div>
  );
}

export function PublicExecutableBlockView(props: PublicExecutableBlockViewProps) {
  const { blockId, type, language, previewHeight: rawPreviewHeight, style, runtimeFactories } = props;
  const originalSource = type === 'shader' ? '' : props.source;
  const originalShaderProgram = type === 'shader' ? props.program : null;
  const resolveAsset = type === 'shader' ? props.resolveAsset : undefined;
  const t = useTranslations('editorCommon.editor.runtimeLabels');
  const actions = useTranslations('common.actions');
  const commonLabels = useTranslations('common.labels');
  const labels = useMemo<PublicExecutableLabels>(() => {
    const common = {
      apply: actions('apply'),
      resetOriginal: t('p5.resetOriginal'),
      availableInputs: t('shader.availableInputs'),
      apiHint: t('shader.apiHint'),
      sharedStage: t('shader.sharedStage'),
      capabilities: t('p5.capabilities'),
      capabilitiesDescription: t('p5.capabilitiesDescription'),
      suggestedByCode: t('p5.suggestedByCode'),
      unsupportedCapability: t('p5.unsupportedCapability'),
      capabilityLabels: {
        camera: t('p5.capabilityCamera'),
        microphone: t('p5.capabilityMicrophone'),
        motion: t('p5.capabilityMotion'),
        midi: t('p5.capabilityMidi'),
        gamepad: t('p5.capabilityGamepad'),
        serial: t('p5.capabilitySerial'),
        location: t('p5.capabilityLocation'),
        bluetooth: t('p5.capabilityBluetooth'),
      },
    };
    if (type === 'p5Sketch') {
      return {
        title: t('p5.title'),
        edit: t('p5.edit'),
        source: t('p5.source'),
        preview: t('p5.preview'),
        run: t('p5.run'),
        stop: t('p5.stop'),
        restart: t('p5.restart'),
        copy: t('p5.copy'),
        copied: t('p5.copied'),
        sourceInput: t('p5.sourceInput'),
        running: t('p5.running'),
        stopped: t('p5.stopped'),
        error: t('p5.error'),
        ...common,
      };
    }
    if (type === 'threeScene') {
      return {
        title: t('three.title'),
        edit: t('three.edit'),
        source: t('three.source'),
        preview: t('three.preview'),
        run: t('three.run'),
        stop: t('three.stop'),
        restart: t('three.restart'),
        copy: t('three.copy'),
        copied: t('three.copied'),
        sourceInput: t('three.sourceInput'),
        running: t('three.running'),
        stopped: t('three.stopped'),
        error: t('three.error'),
        ...common,
      };
    }
    return {
      title: t('shader.title'),
      edit: t('shader.edit'),
      source: t('shader.source'),
      preview: t('shader.preview'),
      run: t('shader.run'),
      stop: t('shader.stop'),
      restart: t('shader.restart'),
      copy: t('shader.copy'),
      copied: t('shader.copied'),
      sourceInput: t('shader.sourceInput'),
      running: t('shader.running'),
      stopped: t('shader.stopped'),
      error: t('shader.error'),
      ...common,
    };
  }, [actions, commonLabels, t, type]);
  const title = props.title ?? '';
  const factories = useMemo(() => ({ ...DEFAULT_RUNTIME_FACTORIES, ...runtimeFactories }), [runtimeFactories]);
  const previewHeight = normalizePreviewHeight(rawPreviewHeight);
  const capabilities = useMemo(
    () => normalizeP5Capabilities(type === 'p5Sketch' ? props.capabilities : []),
    [props, type],
  );
  const hasDeviceCapabilities = capabilities.length > 0;
  const [mode, setMode] = useState<PublicExecutableMode>('preview');
  const [activeShaderStage, setActiveShaderStage] = useState<ShaderStage>('image');
  const [shaderAudioEnabled, setShaderAudioEnabled] = useState(false);
  const [temporarySources, setTemporarySources] = useState<PublicExecutableSources>({
    source: originalSource,
    shaderProgram: originalShaderProgram,
  });
  const [previewSources, setPreviewSources] = useState<PublicExecutableSources>({
    source: originalSource,
    shaderProgram: originalShaderProgram,
  });
  const [hasTemporaryFork, setHasTemporaryFork] = useState(false);
  const [running, setRunning] = useState(!hasDeviceCapabilities);
  const [revision, setRevision] = useState(1);
  const [runtimeError, setRuntimeError] = useState<PublicExecutableError | null>(null);
  const [copied, setCopied] = useState(false);
  const runtimeRef = useRef<PublicExecutableRuntime | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalSources = useMemo<PublicExecutableSources>(
    () => ({
      source: originalSource,
      shaderProgram: originalShaderProgram,
    }),
    [originalShaderProgram, originalSource],
  );
  const sources = hasTemporaryFork ? temporarySources : originalSources;
  const codeVisible = mode !== 'preview';
  const showPreview = true;
  const setRuntime = useCallback((runtime: PublicExecutableRuntime | null) => {
    runtimeRef.current = runtime;
  }, []);
  const markInactive = useCallback(() => setRunning(false), []);
  const setError = useCallback((error: PublicExecutableError | null) => {
    setRuntimeError(error);
    if (error) {
      setRunning(false);
    }
  }, []);
  useEffect(() => {
    if (!hasTemporaryFork) {
      setTemporarySources(originalSources);
    }
  }, [hasTemporaryFork, originalSources]);

  useEffect(
    () => () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const selectMode = useCallback((nextMode: PublicExecutableMode) => setMode(nextMode), []);
  const restart = useCallback(() => {
    setRuntimeError(null);
    setRunning(true);
    setRevision((value) => value + 1);
  }, []);
  const stop = useCallback(() => {
    runtimeRef.current?.stop();
    setRunning(false);
  }, []);
  const resetOriginal = useCallback(() => {
    setTemporarySources(originalSources);
    setPreviewSources(originalSources);
    if (showPreview && !hasDeviceCapabilities) {
      restart();
    } else {
      setRunning(false);
    }
  }, [hasDeviceCapabilities, originalSources, restart, showPreview]);
  const applyDraft = useCallback(() => {
    setPreviewSources((current) => {
      if (type !== 'shader') {
        return { ...current, source: temporarySources.source };
      }
      const value = temporarySources.shaderProgram?.sources[activeShaderStage];
      return value === undefined ? current : updateShaderSource(current, activeShaderStage, value);
    });
    setRuntimeError(null);
    if (type === 'p5Sketch' && hasDeviceCapabilities) {
      setRunning(false);
    } else {
      setRunning(true);
      setRevision((value) => value + 1);
    }
  }, [activeShaderStage, hasDeviceCapabilities, temporarySources, type]);
  const toggleSource = useCallback(() => {
    if (codeVisible) {
      selectMode('preview');
      return;
    }
    if (!hasTemporaryFork) {
      setHasTemporaryFork(true);
      setTemporarySources(originalSources);
    }
    selectMode('edit');
  }, [codeVisible, hasTemporaryFork, originalSources, selectMode]);
  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(type === 'shader' ? shaderMarkdown(sources.shaderProgram) : sources.source);
      setCopied(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
    }
  }, [sources.shaderProgram, sources.source, type]);

  return (
    <figure
      className={`${classes.root} executable-block executable-block--${type}`}
      data-content-type={type}
      data-language={language}
      data-mode={mode}
      data-preview-height={previewHeight}
      data-editor-mode="public"
      style={style}
    >
      <div className={classes.header}>
        <ExecutableBlockTitle title={title} fallback={labels.title} editable={false} />
      </div>
      <Stack className={classes.body} gap={0}>
        {showPreview ? (
          <RuntimeSurface
            key={`${type}-${revision}`}
            active={running}
            audioEnabled={shaderAudioEnabled}
            factories={factories}
            height={previewHeight}
            revision={revision}
            sources={previewSources}
            type={type}
            labels={labels}
            onError={setError}
            onRuntime={setRuntime}
            resolveAsset={resolveAsset}
            capabilities={capabilities}
            onInactive={markInactive}
          />
        ) : null}
        <div className={classes.printSource} data-executable-print-source={type}>
          {type === 'shader' ? (
            SHADER_STAGE_DEFINITIONS.map(([stage, , filename]) => {
              const source = originalShaderProgram?.sources[stage] ?? '';
              return source ? (
                <section key={stage} className={classes.printShaderStage} data-print-shader-stage={stage}>
                  <h3 className={classes.printShaderFilename}>{filename}</h3>
                  <PrintCodeSource language="glsl" source={source} />
                </section>
              ) : null;
            })
          ) : (
            <PrintCodeSource language={language} source={originalSource} />
          )}
        </div>
        {runtimeError ? (
          <Alert className={classes.runtimeError} tone="danger" title={labels.error}>
            {formatError(runtimeError)}
          </Alert>
        ) : null}
        <ExecutableRuntimeControls
          className={classes.controls}
          type={type}
          labels={labels}
          running={running}
          onRun={restart}
          onStop={stop}
          onRestart={restart}
          capabilityControl={
            type === 'p5Sketch' ? (
              <P5CapabilityControl capabilities={capabilities} editable={false} labels={labels} />
            ) : undefined
          }
          sourceControl={{ label: labels.source, expanded: codeVisible, onClick: toggleSource }}
          onResetOriginal={codeVisible ? resetOriginal : undefined}
          copyControl={codeVisible ? { label: copied ? labels.copied : labels.copy, onClick: copySource } : undefined}
          applyControl={
            codeVisible
              ? {
                  label: labels.apply,
                  disabled:
                    type === 'shader'
                      ? temporarySources.shaderProgram?.sources[activeShaderStage] ===
                        previewSources.shaderProgram?.sources[activeShaderStage]
                      : temporarySources.source === previewSources.source,
                  onClick: applyDraft,
                }
              : undefined
          }
          audioControl={
            type === 'shader' && sources.shaderProgram?.sources.sound
              ? {
                  label: commonLabels('audio'),
                  pressed: shaderAudioEnabled,
                  onClick: () => {
                    const nextEnabled = !shaderAudioEnabled;
                    if (nextEnabled && runtimeRef.current && 'enableAudio' in runtimeRef.current) {
                      runtimeRef.current.enableAudio();
                    }
                    setShaderAudioEnabled(nextEnabled);
                    setRevision((value) => value + 1);
                  },
                }
              : undefined
          }
        />
        {codeVisible && type !== 'shader' ? (
          <Stack className={classes.sourcePanel} gap={0}>
            <MonacoSourceEditor
              value={temporarySources.source}
              onChange={(value) => setTemporarySources((current) => ({ ...current, source: value }))}
              onApply={applyDraft}
              language={language}
              ariaLabel={labels.sourceInput}
              modelPath={`public/${type}/${encodeURIComponent(blockId)}.${language === 'glsl' ? 'glsl' : language === 'typescript' ? 'ts' : 'js'}`}
              height={Math.max(240, previewHeight)}
              maxLength={100_000}
            />
          </Stack>
        ) : null}
        {codeVisible && type === 'shader' ? (
          <Stack className={classes.sourcePanel} gap={0} data-shader-source-editors>
            <Group gap={4} role="tablist" aria-label={labels.sourceInput} wrap="wrap">
              {SHADER_STAGE_DEFINITIONS.map(([stage, , filename]) => (
                <Button
                  key={stage}
                  role="tab"
                  aria-selected={activeShaderStage === stage}
                  size="compact-xs"
                  tone="neutral"
                  emphasis={activeShaderStage === stage ? 'strong' : 'low'}
                  onClick={() => setActiveShaderStage(stage)}
                >
                  {filename}
                </Button>
              ))}
            </Group>
            {temporarySources.shaderProgram
              ? (() => {
                  const filename = SHADER_STAGE_DEFINITIONS.find(([stage]) => stage === activeShaderStage)![2];
                  const channels =
                    activeShaderStage === 'common' || activeShaderStage === 'vertex'
                      ? []
                      : (temporarySources.shaderProgram.channels[activeShaderStage as ShaderChannelStage] ?? []);
                  return (
                    <>
                      <ShaderAvailableInputs stage={activeShaderStage} channels={channels} labels={labels} />
                      <MonacoSourceEditor
                        key={activeShaderStage}
                        value={temporarySources.shaderProgram.sources[activeShaderStage]}
                        onChange={(value) =>
                          setTemporarySources((current) => updateShaderSource(current, activeShaderStage, value))
                        }
                        onApply={applyDraft}
                        language="glsl"
                        ariaLabel={`${labels.sourceInput} — ${filename}`}
                        modelPath={`public/${type}/${encodeURIComponent(blockId)}/${filename}`}
                        height={Math.max(240, previewHeight)}
                        maxLength={100_000}
                        onMount={installShaderInputMonacoApi}
                      />
                    </>
                  );
                })()
              : null}
          </Stack>
        ) : null}
      </Stack>
    </figure>
  );
}
