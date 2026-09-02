'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { mergeAttributes, Node, type CommandProps, type Editor, type Extensions } from '@tiptap/core';
import { Selection } from '@tiptap/pm/state';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Group, Stack, Text } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { ContentModal } from '@/components/core/Modal';
import { Checkbox, Select } from '@/components/core/Input';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { useBlockResize, type TextAlignment } from '@/features/editor/hooks/useBlockResize';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import {
  isMonacoSourceEditorEvent,
  MonacoSourceEditor,
  type SourceEditorMarker,
} from '@/features/editor/tiptap/code-editor';
import { ExecutableBlockTitle, ExecutableRuntimeControls } from '@/features/executable/ExecutableRuntimeControls';
import { executableBlockIdForPosition } from '../executable-source';
import {
  type ExecutableSelectionMenuBinding,
  type ExecutableSelectionMenuLabels,
  type ExecutableSelectionMenuRegistry,
} from '../menus/executable';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import {
  createShaderPreviewWorkerRuntime,
  type ShaderPreviewRuntime,
  type ShaderPreviewRuntimeFactory,
  type ShaderAssetResolver,
} from './shader-preview-runtime';
import { ShaderPreviewSurface } from './ShaderPublicPreview';
import { ShaderAvailableInputs } from './ShaderApiReference';
import { installShaderInputMonacoApi, type ShaderApiLabels } from './shader-editor-api';
import {
  DEFAULT_SHADER_PROGRAM,
  SHADER_STAGE_DEFINITIONS,
  shaderProgramDocument,
  shaderProgramKey,
  normalizeShaderChannels,
  type ShaderChannel,
  type ShaderChannelStage,
  type ShaderProgramDocument,
  type ShaderStage,
} from './shader-program';
import { SHADER_MAX_SOURCE_LENGTH, type ShaderError } from './shader-source';
import classes from './ShaderNode.module.css';

export type ShaderMode = 'edit' | 'source' | 'preview';
export interface ShaderLabels extends ShaderApiLabels {
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
  running: string;
  stopped: string;
  error: string;
  sourceInput: string;
  resizeLeft: string;
  resizeRight: string;
  audio?: string;
  close?: string;
}

export const SHADER_LABEL_KEYS = [
  'title',
  'edit',
  'source',
  'preview',
  'run',
  'stop',
  'restart',
  'apply',
  'copy',
  'copied',
  'resetOriginal',
  'running',
  'stopped',
  'error',
  'sourceInput',
  'resizeLeft',
  'resizeRight',
  'availableInputs',
  'apiHint',
  'sharedStage',
] as const satisfies readonly (keyof ShaderLabels)[];

export const DEFAULT_SHADER_LABELS = {
  title: 'Shader',
  edit: 'Edit',
  source: 'Source',
  preview: 'Preview',
  run: 'Run',
  stop: 'Stop',
  restart: 'Restart',
  apply: 'Apply',
  copy: 'Copy',
  copied: 'Copied',
  running: 'Running',
  stopped: 'Stopped',
  resetOriginal: 'Reset to original',
  error: 'Error',
  sourceInput: 'GLSL shader source',
  resizeLeft: 'Resize shader from left',
  resizeRight: 'Resize shader from right',
  audio: 'Enable audio',
  close: 'Close',
  availableInputs: 'Available inputs',
  apiHint: 'Hover',
  sharedStage: 'Shared declarations · no entry point',
} satisfies ShaderLabels;

export const KOREAN_SHADER_LABELS = {
  title: '셰이더',
  edit: '편집',
  source: '소스',
  preview: '미리보기',
  run: '실행',
  stop: '중지',
  restart: '다시 실행',
  apply: '적용',
  copy: '복사',
  copied: '복사됨',
  running: '실행 중',
  stopped: '중지됨',
  resetOriginal: '원본으로 초기화',
  error: '오류',
  sourceInput: 'GLSL 셰이더 소스',
  resizeLeft: '왼쪽에서 셰이더 너비 조절',
  resizeRight: '오른쪽에서 셰이더 너비 조절',
  audio: '오디오 실행',
  close: '닫기',
  availableInputs: '사용 가능한 입력',
  apiHint: '마우스 올리기',
  sharedStage: '공통 선언 · 진입점 없음',
} satisfies ShaderLabels;

export interface ShaderOptions {
  labels?: Partial<ShaderLabels>;
  runtimeFactory?: ShaderPreviewRuntimeFactory;
  autoRunReadOnly?: boolean;
  authoringMode?: EditorAuthoringMode | null;
  selectionMenuRegistry?: ExecutableSelectionMenuRegistry;
  selectionMenuLabels?: Pick<
    ExecutableSelectionMenuLabels,
    'deleteBlock' | 'alignment' | 'alignLeft' | 'alignCenter' | 'alignRight'
  >;
  resolveAsset?: ShaderAssetResolver;
  filePicker?: ComponentType<ShaderFilePickerProps>;
}

export interface ShaderFilePickerProps {
  kind: 'image' | 'video';
  onSelect: (fileId: string) => void;
}

export interface InsertShaderOptions {
  title?: string;
  stages?: Partial<Record<ShaderStage, string>>;
  channels?: ShaderProgramDocument['channels'];
  vertexSource?: string;
  fragmentSource?: string;
  mode?: ShaderMode;
  previewHeight?: number;
  previewWidth?: string | number;
  textAlignment?: TextAlignment;
  blockId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    shader: {
      insertShader: (options?: InsertShaderOptions) => ReturnType;
    };
  }
}

function requireLabels(labels: Partial<ShaderLabels> | undefined): ShaderLabels {
  const resolved = { ...DEFAULT_SHADER_LABELS, ...labels };
  const missing = SHADER_LABEL_KEYS.filter((key) => !resolved[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Shader labels are required: ${missing.join(', ')}`);
  }
  return resolved;
}

function normalizeMode(value: unknown): ShaderMode {
  return value === 'source' || value === 'preview' ? value : 'edit';
}

function normalizePreviewHeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(720, Math.max(180, Math.round(parsed))) : 360;
}

function normalizePreviewWidth(value: unknown): string {
  const parsed = Number.parseInt(String(value ?? '100'), 10);
  return String(Number.isFinite(parsed) ? Math.min(100, Math.max(10, parsed)) : 100);
}

function normalizeAlignment(value: unknown): TextAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function resolveShaderViewMode(
  canEditNeutral: boolean,
  durableMode: ShaderMode,
  publicMode: ShaderMode,
): ShaderMode {
  return canEditNeutral ? durableMode : publicMode;
}

export function selectShaderNode(editor: Editor, getPos: () => number | undefined): boolean {
  if (!editor.isEditable) {
    return false;
  }
  const position = getPos();
  if (typeof position !== 'number' || editor.state.doc.nodeAt(position)?.type.name !== 'shader') {
    return false;
  }
  editor.commands.setNodeSelection(position);
  editor.view.focus();
  return true;
}

function makeBlockId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `shader-${Date.now().toString(36)}`;
}

export function markerFor(error: ShaderError | null, activeStage: ShaderStage): readonly SourceEditorMarker[] {
  if (!error?.line || error.stage !== activeStage) {
    return [];
  }
  return [
    {
      message: error.message,
      severity: 'error',
      startLineNumber: error.line,
      startColumn: error.column ?? 1,
      source: 'WebGL2',
      code: error.kind,
    },
  ];
}

function stageIndex(stage: ShaderStage): number {
  return SHADER_STAGE_DEFINITIONS.findIndex(([candidate]) => candidate === stage);
}

function reconcileShaderDraftSources(
  current: ShaderProgramDocument['sources'],
  previous: ShaderProgramDocument['sources'],
  next: ShaderProgramDocument['sources'],
): ShaderProgramDocument['sources'] {
  const source = (stage: ShaderStage) => (current[stage] === previous[stage] ? next[stage] : current[stage]);
  return {
    common: source('common'),
    vertex: source('vertex'),
    bufferA: source('bufferA'),
    bufferB: source('bufferB'),
    bufferC: source('bufferC'),
    bufferD: source('bufferD'),
    cubemap: source('cubemap'),
    sound: source('sound'),
    image: source('image'),
  };
}

export function replaceShaderStageSource({
  editor,
  getPos,
  stage,
  value,
  canEditNeutral = true,
}: {
  editor: Editor;
  getPos: () => number | undefined;
  stage: ShaderStage;
  value: string;
  canEditNeutral?: boolean;
}): boolean {
  if (!editor.isEditable || !canEditNeutral) {
    return false;
  }
  const position = getPos();
  if (typeof position !== 'number') {
    return false;
  }
  const shader = editor.state.doc.nodeAt(position);
  const index = stageIndex(stage);
  if (
    !shader ||
    shader.type.name !== 'shader' ||
    shader.childCount !== SHADER_STAGE_DEFINITIONS.length ||
    shader.child(index).type.name !== SHADER_STAGE_DEFINITIONS[index]?.[1]
  ) {
    return false;
  }
  let childOffset = 0;
  for (let current = 0; current < index; current += 1) {
    childOffset += shader.child(current).nodeSize;
  }
  const child = shader.child(index);
  const from = position + 1 + childOffset + 1;
  editor.view.dispatch(
    editor.state.tr.insertText(value.slice(0, SHADER_MAX_SOURCE_LENGTH), from, from + child.content.size),
  );
  return true;
}

export function replaceShaderStageChannels({
  editor,
  getPos,
  stage,
  channels,
  canEditNeutral,
}: {
  editor: Editor;
  getPos: () => number | undefined;
  stage: ShaderChannelStage;
  channels: readonly ShaderChannel[];
  canEditNeutral: boolean;
}): boolean {
  if (!editor.isEditable || !canEditNeutral) {
    return false;
  }
  const position = getPos();
  const index = stageIndex(stage);
  if (typeof position !== 'number' || index < 0) {
    return false;
  }
  const shader = editor.state.doc.nodeAt(position);
  if (!shader || shader.type.name !== 'shader' || shader.childCount !== SHADER_STAGE_DEFINITIONS.length) {
    return false;
  }
  let childOffset = 0;
  for (let current = 0; current < index; current += 1) {
    childOffset += shader.child(current).nodeSize;
  }
  const childPosition = position + 1 + childOffset;
  const child = shader.child(index);
  editor.view.dispatch(editor.state.tr.setNodeMarkup(childPosition, undefined, { ...child.attrs, channels }));
  return true;
}

const CHANNEL_STAGES = new Set<ShaderStage>(['bufferA', 'bufferB', 'bufferC', 'bufferD', 'cubemap', 'sound', 'image']);

function ShaderChannelPanel({
  channels,
  onChange,
  labels,
  FilePicker,
}: {
  channels: readonly ShaderChannel[];
  onChange: (channels: readonly ShaderChannel[]) => void;
  labels: Pick<ShaderLabels, 'title' | 'close'>;
  FilePicker?: ComponentType<ShaderFilePickerProps>;
}) {
  const normalized = normalizeShaderChannels(channels);
  const [picker, setPicker] = useState<{
    index: number;
    kind: 'textureFile' | 'videoFile' | 'cubemapFiles';
    face?: number;
  } | null>(null);
  const [cubeDrafts, setCubeDrafts] = useState<Record<number, string[]>>({});
  const cubeFaces = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'];
  const update = (index: number, channel: ShaderChannel) => {
    const next = [...normalized];
    next[index] = channel;
    onChange(next);
  };
  return (
    <Stack gap="xs" data-testid="shader-channel-panel">
      {normalized.map((channel, index) => (
        <Group key={index} gap="xs" align="end" wrap="wrap">
          <Text size="xs">iChannel{index}</Text>
          <Select
            size="xs"
            value={channel.kind}
            data={
              FilePicker
                ? ['none', 'buffer', 'textureFile', 'videoFile', 'cubemapFiles', 'cubemapPass']
                : ['none', 'buffer', 'cubemapPass']
            }
            onChange={(kind) => {
              if (kind === 'buffer') {
                update(index, { kind, buffer: 'A' });
              } else if (kind === 'cubemapPass') {
                update(index, { kind, sampler: { filter: 'linear', wrap: 'clamp', vflip: false } });
              } else if (kind === 'textureFile' || kind === 'videoFile' || kind === 'cubemapFiles') {
                setPicker({ index, kind });
              } else {
                update(index, { kind: 'none' });
              }
            }}
          />
          {channel.kind === 'buffer' ? (
            <Select
              size="xs"
              value={channel.buffer}
              data={['A', 'B', 'C', 'D']}
              onChange={(buffer) => update(index, { kind: 'buffer', buffer: (buffer ?? 'A') as 'A' | 'B' | 'C' | 'D' })}
            />
          ) : null}
          {'sampler' in channel ? (
            <>
              <Select
                size="xs"
                value={channel.sampler.filter}
                data={['nearest', 'linear']}
                onChange={(filter) =>
                  update(index, {
                    ...channel,
                    sampler: { ...channel.sampler, filter: filter === 'linear' ? 'linear' : 'nearest' },
                  } as ShaderChannel)
                }
              />
              <Select
                size="xs"
                value={channel.sampler.wrap}
                data={['clamp', 'repeat']}
                onChange={(wrap) =>
                  update(index, {
                    ...channel,
                    sampler: { ...channel.sampler, wrap: wrap === 'repeat' ? 'repeat' : 'clamp' },
                  } as ShaderChannel)
                }
              />
              <Checkbox
                size="xs"
                label="vflip"
                checked={channel.sampler.vflip}
                onChange={(event) =>
                  update(index, {
                    ...channel,
                    sampler: { ...channel.sampler, vflip: event.currentTarget.checked },
                  } as ShaderChannel)
                }
              />
            </>
          ) : null}
          {channel.kind === 'textureFile' || channel.kind === 'videoFile' ? (
            <Text size="xs">File {channel.fileId.slice(0, 12)}</Text>
          ) : null}
          {channel.kind === 'cubemapFiles'
            ? channel.fileIds.map((fileId, faceIndex) => (
                <Button
                  key={cubeFaces[faceIndex]}
                  size="compact-xs"
                  tone="neutral"
                  emphasis="low"
                  onClick={() => setPicker({ index, kind: 'cubemapFiles', face: faceIndex })}
                >
                  {cubeFaces[faceIndex]} {fileId.slice(0, 8)}
                </Button>
              ))
            : null}
          {cubeDrafts[index]
            ? cubeFaces.map((face, faceIndex) => (
                <Button
                  key={face}
                  size="compact-xs"
                  tone="neutral"
                  emphasis="low"
                  onClick={() => setPicker({ index, kind: 'cubemapFiles', face: faceIndex })}
                >
                  {face} {cubeDrafts[index]?.[faceIndex]?.slice(0, 8) || '—'}
                </Button>
              ))
            : null}
        </Group>
      ))}
      {picker && FilePicker ? (
        <ContentModal
          opened={picker !== null}
          onClose={() => setPicker(null)}
          title={`${labels.title} — ${picker.kind}`}
          closeLabel={labels.close ?? 'Close'}
          size="wide"
        >
          <FilePicker
            key={`${picker.kind}:${picker.face ?? 0}`}
            kind={picker.kind === 'videoFile' ? 'video' : 'image'}
            onSelect={(fileId) => {
              const sampler = { filter: 'linear' as const, wrap: 'clamp' as const, vflip: false };
              if (picker.kind === 'cubemapFiles') {
                const existingChannel = normalized[picker.index];
                const current = [
                  ...(cubeDrafts[picker.index] ??
                    (existingChannel?.kind === 'cubemapFiles' ? existingChannel.fileIds : ['', '', '', '', '', ''])),
                ];
                current[picker.face ?? 0] = fileId;
                setCubeDrafts((drafts) => ({ ...drafts, [picker.index]: current }));
                if (current.every(Boolean)) {
                  update(picker.index, {
                    kind: 'cubemapFiles',
                    fileIds: current as [string, string, string, string, string, string],
                    sampler,
                  });
                  setCubeDrafts((drafts) => {
                    const next = { ...drafts };
                    delete next[picker.index];
                    return next;
                  });
                }
              } else {
                update(picker.index, { kind: picker.kind, fileId, sampler });
              }
              setPicker(null);
            }}
          />
        </ContentModal>
      ) : null}
    </Stack>
  );
}

export function ShaderNodeView(props: NodeViewProps & ShaderOptions) {
  const {
    editor,
    getPos,
    node,
    updateAttributes,
    labels: providedLabels,
    runtimeFactory = createShaderPreviewWorkerRuntime,
    autoRunReadOnly = true,
    selectionMenuRegistry,
    selectionMenuLabels,
    authoringMode,
    resolveAsset,
    filePicker: FilePicker,
  } = props;
  const labels = useMemo(() => requireLabels(providedLabels), [providedLabels]);
  const editable = useTiptapEditorEditable(editor);
  const canEditNeutral = editable && authoringMode?.allowNeutralBlockEdits === true;
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditTitle = editable && authoringMode?.allowLocalizedBlockEdits === true;
  const authoringSelected = canEditNeutral && exactNodeSelected;
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : '';
  const originalProgram = useMemo(() => shaderProgramDocument(node), [node]);
  const durableMode = normalizeMode(node.attrs.mode);
  const previewHeight = normalizePreviewHeight(node.attrs.previewHeight);
  const previewWidth = normalizePreviewWidth(node.attrs.previewWidth);
  const textAlignment = normalizeAlignment(node.attrs.textAlignment);
  const blockId = executableBlockIdForPosition({ editor, getPos });
  const containerRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ShaderPreviewRuntime | null>(null);
  const [publicMode, setPublicMode] = useState<ShaderMode>('preview');
  const [temporaryProgram, setTemporaryProgram] = useState<ShaderProgramDocument>(originalProgram);
  const [hasTemporaryFork, setHasTemporaryFork] = useState(false);
  const [activeStage, setActiveStage] = useState<ShaderStage>('image');
  const mode = resolveShaderViewMode(canEditNeutral, durableMode, publicMode);
  const program = hasTemporaryFork ? temporaryProgram : originalProgram;
  const activeSource = program.sources[activeStage];
  const [draftSources, setDraftSources] = useState(program.sources);
  const activeDraftSource = draftSources[activeStage];
  const hasActiveDraftChanges = activeDraftSource !== activeSource;
  const codeVisible = mode !== 'preview';
  const previewVisible = true;
  const initiallyRunning = canEditNeutral ? durableMode !== 'source' : autoRunReadOnly;
  const [running, setRunning] = useState(initiallyRunning);
  const [revision, setRevision] = useState(initiallyRunning ? 1 : 0);
  const [runtimeError, setRuntimeError] = useState<ShaderError | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programKey = shaderProgramKey(program);
  const appliedSourcesRef = useRef(program.sources);
  const previousSource = useRef(programKey);
  const previousReadOnlyPreview = useRef(!canEditNeutral && mode === 'preview' && autoRunReadOnly);
  const setRuntime = useCallback((runtime: ShaderPreviewRuntime | null) => {
    runtimeRef.current = runtime;
  }, []);
  const handleRuntimeError = useCallback((error: ShaderError | null) => {
    setRuntimeError(error);
    if (error) {
      setRunning(false);
    }
  }, []);
  const sendPointer = useCallback((x: number, y: number, pressed: boolean) => {
    runtimeRef.current?.pointer(x, y, pressed);
  }, []);
  const resizeRuntime = useCallback((width: number, height: number) => {
    runtimeRef.current?.resize(width, height);
  }, []);
  const persistWidth = useCallback(
    (width: number) => {
      if (editor.isEditable && authoringMode?.allowNeutralBlockEdits === true) {
        updateAttributes({ previewWidth: String(width) });
      }
    },
    [authoringMode, editor, updateAttributes],
  );
  const resize = useBlockResize({
    containerRef,
    previewWidth,
    enabled: authoringSelected,
    onResize: persistWidth,
    keyboardSession: { owner: editor, key: `shader:${blockId}` },
  });

  useEffect(() => {
    if (!hasTemporaryFork) {
      setTemporaryProgram(originalProgram);
    }
  }, [hasTemporaryFork, node]);

  useEffect(() => {
    const previousSources = appliedSourcesRef.current;
    appliedSourcesRef.current = program.sources;
    setDraftSources((current) => reconcileShaderDraftSources(current, previousSources, program.sources));
  }, [programKey, program.sources]);

  useEffect(() => {
    const shouldAutoRun = !canEditNeutral && mode === 'preview' && autoRunReadOnly;
    const transitioned = shouldAutoRun && !previousReadOnlyPreview.current;
    previousReadOnlyPreview.current = shouldAutoRun;
    if (!transitioned) {
      return;
    }
    setRuntimeError(null);
    setRunning(true);
    setRevision((value) => value + 1);
  }, [autoRunReadOnly, canEditNeutral, mode]);

  useEffect(() => {
    if (previousSource.current === programKey) {
      return;
    }
    previousSource.current = programKey;
    if (mode === 'source' || (!running && !runtimeError && mode !== 'edit')) {
      return;
    }
    setRuntimeError(null);
    if (!running) {
      setRunning(true);
    }
    setRevision((value) => value + 1);
  }, [mode, programKey, running, runtimeError]);

  useEffect(() => {
    if (runtimeError?.kind === 'compile' && runtimeError.stage && runtimeError.stage !== 'link') {
      setActiveStage(runtimeError.stage);
    }
  }, [runtimeError]);

  useEffect(
    () => () => {
      runtimeRef.current?.dispose();
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    [],
  );

  const setMode = useCallback(
    (nextMode: ShaderMode) => {
      if (editor.isEditable && authoringMode?.allowNeutralBlockEdits === true) {
        updateAttributes({ mode: nextMode });
      } else {
        setPublicMode(nextMode);
      }
      if (nextMode !== 'source') {
        setRuntimeError(null);
        setRunning(true);
        setRevision((value) => value + 1);
      } else {
        runtimeRef.current?.stop();
        setRunning(false);
      }
    },
    [authoringMode, editor, updateAttributes],
  );
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
    setRuntimeError(null);
    setTemporaryProgram(originalProgram);
    setDraftSources(originalProgram.sources);
    restart();
  }, [originalProgram, restart]);
  const applyActiveDraft = useCallback(() => {
    if (!hasActiveDraftChanges) {
      return;
    }
    if (canEditNeutral) {
      replaceShaderStageSource({
        editor,
        getPos,
        stage: activeStage,
        value: activeDraftSource,
        canEditNeutral: authoringMode?.allowNeutralBlockEdits === true,
      });
    } else if (!editable && hasTemporaryFork) {
      setTemporaryProgram((current) => ({
        ...current,
        sources: { ...current.sources, [activeStage]: activeDraftSource },
      }));
    }
  }, [
    activeDraftSource,
    activeStage,
    authoringMode,
    canEditNeutral,
    editable,
    editor,
    getPos,
    hasActiveDraftChanges,
    hasTemporaryFork,
  ]);
  const toggleSource = useCallback(() => {
    if (codeVisible) {
      setMode('preview');
      return;
    }
    if (!editable && !hasTemporaryFork) {
      setHasTemporaryFork(true);
      setTemporaryProgram(originalProgram);
      setDraftSources(originalProgram.sources);
    }
    setMode(canEditNeutral || !editable ? 'edit' : 'source');
  }, [canEditNeutral, codeVisible, editable, hasTemporaryFork, originalProgram, setMode]);
  const selectBlock = useCallback(() => {
    selectShaderNode(editor, getPos);
  }, [editor, getPos]);
  const deleteBlock = useCallback(() => {
    if (!canEditNeutral) {
      return;
    }
    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }
    const $content = editor.state.doc.resolve(position);
    if ($content.parent.type.name !== 'blockContainer') {
      return;
    }
    const blockPosition = $content.before();
    const $block = editor.state.doc.resolve(blockPosition);
    const block = editor.state.doc.nodeAt(blockPosition);
    if (!block || $block.parent.type.name !== 'blockGroup' || ($block.parent.childCount === 1 && $block.depth <= 1)) {
      return;
    }
    const transaction = editor.state.tr;
    if ($block.parent.childCount === 1) {
      transaction.delete($block.before(), $block.after());
    } else {
      transaction.delete(blockPosition, blockPosition + block.nodeSize);
    }
    transaction.setSelection(
      Selection.near(transaction.doc.resolve(Math.min(blockPosition + 2, transaction.doc.content.size))),
    );
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  }, [canEditNeutral, editor, getPos]);
  const selectionMenuBinding = useMemo<ExecutableSelectionMenuBinding>(
    () => ({
      snapshot: {
        blockType: 'shader',
        mode,
        running,
        textAlignment,
        labels: {
          menu: labels.title,
          edit: labels.edit,
          source: labels.source,
          preview: labels.preview,
          run: labels.run,
          stop: labels.stop,
          restart: labels.restart,
          deleteBlock: selectionMenuLabels?.deleteBlock ?? 'Delete',
          alignment: selectionMenuLabels?.alignment ?? 'Alignment',
          alignLeft: selectionMenuLabels?.alignLeft ?? 'Align left',
          alignCenter: selectionMenuLabels?.alignCenter ?? 'Align center',
          alignRight: selectionMenuLabels?.alignRight ?? 'Align right',
        },
      },
      commands: {
        setMode,
        run: restart,
        stop,
        restart,
        setAlignment: (alignment) => {
          if (editor.isEditable && authoringMode?.allowNeutralBlockEdits === true) {
            updateAttributes({ textAlignment: alignment });
          }
        },
        deleteBlock,
      },
    }),
    [
      authoringMode,
      deleteBlock,
      editor,
      labels,
      mode,
      restart,
      running,
      selectionMenuLabels,
      setMode,
      stop,
      textAlignment,
      updateAttributes,
    ],
  );
  const selectionMenuBindingRef = useRef(selectionMenuBinding);
  selectionMenuBindingRef.current = selectionMenuBinding;
  const liveSelectionMenuBinding = useMemo<ExecutableSelectionMenuBinding>(
    () => ({
      get snapshot() {
        return selectionMenuBindingRef.current.snapshot;
      },
      get commands() {
        return selectionMenuBindingRef.current.commands;
      },
    }),
    [],
  );
  useEffect(() => {
    if (!selectionMenuRegistry || !blockId || !canEditNeutral) {
      return;
    }
    return selectionMenuRegistry.register(blockId, liveSelectionMenuBinding);
  }, [blockId, canEditNeutral, liveSelectionMenuBinding, selectionMenuRegistry]);
  useEffect(() => {
    selectionMenuRegistry?.notify();
  }, [mode, running, selectionMenuRegistry, textAlignment]);
  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mode === 'edit' ? activeDraftSource : activeSource);
      setCopied(true);
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
      copyTimer.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
    }
  }, [activeDraftSource, activeSource, mode]);

  return (
    <NodeViewWrapper
      className={classes.node}
      data-content-type="shader"
      data-selected={authoringSelected || undefined}
      data-editor-mode={editable ? 'authoring' : 'public'}
      data-text-alignment={textAlignment}
      contentEditable={false}
    >
      <EditorMediaBlockFrame
        className={classes.frame}
        containerRef={containerRef}
        widthPercent={resize.widthPercent}
        margin={resize.getMarginStyle(textAlignment)}
        allowResize={authoringSelected}
        suppressStaticTextSelection
        isResizing={resize.isDragging !== null}
        selected={authoringSelected}
        resizeMin={resize.minWidth}
        resizeMax={resize.maxWidth}
        resizeLeftLabel={labels.resizeLeft}
        resizeRightLabel={labels.resizeRight}
        onResizeLeftPointerDown={resize.startResizeLeft}
        onResizeRightPointerDown={resize.startResizeRight}
        onResizeLeftKeyDown={resize.onResizeKeyDown}
        onResizeRightKeyDown={resize.onResizeKeyDown}
        onResizeBlur={resize.onResizeBlur}
      >
        <div className={classes.root}>
          <div className={classes.header}>
            <ExecutableBlockTitle
              title={title}
              fallback={labels.title}
              editable={canEditTitle}
              onChange={(nextTitle) => updateAttributes({ title: nextTitle })}
            />
          </div>
          <Stack className={classes.body} data-mode={mode} gap={0}>
            {previewVisible ? (
              <div className={classes.resultPane} data-testid="shader-result-pane">
                <ShaderPreviewSurface
                  program={program}
                  resolveAsset={resolveAsset}
                  height={previewHeight}
                  revision={revision}
                  active={running}
                  runtimeFactory={runtimeFactory}
                  labels={labels}
                  onRuntime={setRuntime}
                  onError={handleRuntimeError}
                  onPointer={sendPointer}
                  onResize={resizeRuntime}
                />
              </div>
            ) : null}
            <ExecutableRuntimeControls
              className={classes.runtimeControls}
              type="shader"
              labels={labels}
              running={running}
              onRun={restart}
              onStop={stop}
              onRestart={restart}
              sourceControl={{ label: labels.source, expanded: codeVisible, onClick: toggleSource }}
              onResetOriginal={codeVisible ? resetOriginal : undefined}
              resetDisabled={!hasActiveDraftChanges && shaderProgramKey(program) === shaderProgramKey(originalProgram)}
              copyControl={
                codeVisible ? { label: copied ? labels.copied : labels.copy, onClick: copySource } : undefined
              }
              applyControl={
                mode === 'edit'
                  ? { label: labels.apply, disabled: !hasActiveDraftChanges, onClick: applyActiveDraft }
                  : undefined
              }
              audioControl={
                canEditNeutral && program.sources.sound.trim() && !audioEnabled
                  ? {
                      label: labels.audio ?? 'Audio',
                      onClick: () => {
                        runtimeRef.current?.enableAudio();
                        setAudioEnabled(true);
                      },
                    }
                  : undefined
              }
            />
            {mode === 'edit' || mode === 'source' ? (
              <Stack gap="xs" data-testid="shader-stage-source">
                <Group gap={4} role="tablist" aria-label={labels.sourceInput}>
                  {SHADER_STAGE_DEFINITIONS.map(([stage, , filename]) => (
                    <Button
                      key={stage}
                      role="tab"
                      aria-selected={activeStage === stage}
                      size="compact-xs"
                      tone="neutral"
                      emphasis={activeStage === stage ? 'strong' : 'low'}
                      onClick={() => setActiveStage(stage)}
                    >
                      {filename}
                    </Button>
                  ))}
                </Group>
                {mode === 'edit' && canEditNeutral && CHANNEL_STAGES.has(activeStage) ? (
                  <ShaderChannelPanel
                    labels={labels}
                    FilePicker={FilePicker}
                    channels={program.channels[activeStage as ShaderChannelStage] ?? []}
                    onChange={(channels) => {
                      replaceShaderStageChannels({
                        editor,
                        getPos,
                        stage: activeStage as ShaderChannelStage,
                        channels,
                        canEditNeutral: authoringMode?.allowNeutralBlockEdits === true,
                      });
                    }}
                  />
                ) : null}
                <ShaderAvailableInputs
                  stage={activeStage}
                  channels={
                    CHANNEL_STAGES.has(activeStage) ? (program.channels[activeStage as ShaderChannelStage] ?? []) : []
                  }
                  labels={labels}
                />
                <MonacoSourceEditor
                  value={mode === 'edit' ? activeDraftSource : activeSource}
                  onChange={
                    mode === 'edit'
                      ? (value) => setDraftSources((current) => ({ ...current, [activeStage]: value }))
                      : undefined
                  }
                  onApply={applyActiveDraft}
                  onEscape={selectBlock}
                  language="glsl"
                  readOnly={mode !== 'edit' || (!canEditNeutral && !hasTemporaryFork)}
                  ariaLabel={`${SHADER_STAGE_DEFINITIONS.find(([stage]) => stage === activeStage)?.[2]} ${labels.sourceInput}`}
                  modelPath={`shader/${blockId}/${SHADER_STAGE_DEFINITIONS.find(([stage]) => stage === activeStage)?.[2]}`}
                  height={Math.max(240, previewHeight)}
                  maxLength={SHADER_MAX_SOURCE_LENGTH}
                  markers={markerFor(runtimeError, activeStage)}
                  onMount={installShaderInputMonacoApi}
                />
              </Stack>
            ) : null}
          </Stack>
        </div>
      </EditorMediaBlockFrame>
      <NodeViewContent className={classes.content} aria-hidden="true" />
    </NodeViewWrapper>
  );
}

const shaderStageExtensions = SHADER_STAGE_DEFINITIONS.map(([stage, nodeName, filename]) =>
  Node.create({
    name: nodeName,
    content: 'text*',
    marks: '',
    code: true,
    defining: true,
    addAttributes: () => ({
      ...(stage === 'bufferA' ||
      stage === 'bufferB' ||
      stage === 'bufferC' ||
      stage === 'bufferD' ||
      stage === 'cubemap' ||
      stage === 'sound' ||
      stage === 'image'
        ? { channels: { default: null } }
        : {}),
    }),
    parseHTML: () => [{ tag: `[data-shader-stage="${stage}"]`, preserveWhitespace: 'full' }],
    renderHTML: ({ HTMLAttributes }) => [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-shader-stage': stage, 'data-shader-filename': filename }),
      ['code', 0],
    ],
  }),
);

export function createShaderExtension(options: ShaderOptions = {}): Extensions[number] {
  const resolved = { ...options, labels: requireLabels(options.labels) };
  return Node.create<ShaderOptions>({
    name: 'shader',
    group: 'blockContent',
    content: SHADER_STAGE_DEFINITIONS.map(([, nodeName]) => nodeName).join(' '),
    marks: '',
    defining: true,
    isolating: true,
    selectable: true,
    draggable: false,
    code: true,
    addExtensions() {
      return shaderStageExtensions;
    },
    addOptions: () => resolved,
    addAttributes() {
      return {
        title: {
          default: '',
          parseHTML: (element) => element.getAttribute('data-title') ?? '',
          renderHTML: ({ title }) => ({ 'data-title': typeof title === 'string' ? title : '' }),
        },
        mode: {
          default: 'edit',
          parseHTML: (element) => normalizeMode(element.getAttribute('data-mode')),
          renderHTML: ({ mode }) => ({ 'data-mode': normalizeMode(mode) }),
        },
        previewHeight: {
          default: 360,
          parseHTML: (element) => normalizePreviewHeight(element.getAttribute('data-preview-height')),
          renderHTML: ({ previewHeight }) => ({ 'data-preview-height': normalizePreviewHeight(previewHeight) }),
        },
        previewWidth: {
          default: '100',
          parseHTML: (element) => normalizePreviewWidth(element.getAttribute('data-preview-width')),
          renderHTML: ({ previewWidth }) => ({ 'data-preview-width': normalizePreviewWidth(previewWidth) }),
        },
        textAlignment: {
          default: 'left',
          parseHTML: (element) => normalizeAlignment(element.getAttribute('data-text-alignment')),
          renderHTML: ({ textAlignment }) => ({ 'data-text-alignment': normalizeAlignment(textAlignment) }),
        },
      };
    },
    parseHTML() {
      return [{ tag: '[data-content-type="shader"]', preserveWhitespace: 'full' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-content-type': 'shader' }), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) => <ShaderNodeView {...props} {...this.options} />, {
        stopEvent: ({ event }) =>
          isMonacoSourceEditorEvent(event) ||
          (event.target instanceof Element && event.target.closest('[data-testid="shader-available-inputs"]') !== null),
      });
    },
    addCommands() {
      return {
        insertShader:
          (input = {}) =>
          ({ commands, editor }: CommandProps) => {
            if (
              !editor.isEditable ||
              this.options.authoringMode?.allowNeutralBlockEdits !== true ||
              !editor.schema.nodes.blockContainer ||
              !editor.schema.nodes.shader
            ) {
              return false;
            }
            const stages = {
              ...DEFAULT_SHADER_PROGRAM.sources,
              ...input.stages,
              ...(input.vertexSource ? { vertex: input.vertexSource } : {}),
              ...(input.fragmentSource ? { image: input.fragmentSource } : {}),
            };
            return commands.insertContent({
              type: 'blockContainer',
              attrs: { id: input.blockId ?? makeBlockId() },
              content: [
                {
                  type: 'shader',
                  attrs: {
                    title: input.title ?? '',
                    mode: normalizeMode(input.mode),
                    previewHeight: normalizePreviewHeight(input.previewHeight),
                    previewWidth: normalizePreviewWidth(input.previewWidth),
                    textAlignment: normalizeAlignment(input.textAlignment),
                  },
                  content: SHADER_STAGE_DEFINITIONS.map(([stage, nodeName]) => {
                    const source = stages[stage].slice(0, SHADER_MAX_SOURCE_LENGTH);
                    const channels = input.channels?.[stage as keyof typeof input.channels];
                    return {
                      type: nodeName,
                      ...(channels ? { attrs: { channels } } : {}),
                      ...(source ? { content: [{ type: 'text', text: source }] } : {}),
                    };
                  }),
                },
              ],
            });
          },
      };
    },
  });
}
