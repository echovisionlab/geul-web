'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mergeAttributes, Node, type CommandProps, type Extensions } from '@tiptap/core';
import type { Monaco } from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { Selection } from '@tiptap/pm/state';
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react';
import { Stack } from '@mantine/core';
import { Alert } from '@/components/core/Alert';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import {
  ExecutableBlockTitle,
  ExecutableRuntimeControls,
  ExecutableRuntimeStatus,
} from '@/features/executable/ExecutableRuntimeControls';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import { isMonacoSourceEditorEvent, MonacoSourceEditor } from '../code-editor';
import { executableBlockIdForPosition, replaceExecutableSource } from '../executable-source';
import {
  type ExecutableSelectionMenuBinding,
  type ExecutableSelectionMenuLabels,
  type ExecutableSelectionMenuRegistry,
} from '../menus/executable';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';
import {
  createThreePreviewWorkerRuntime,
  type ThreePreviewRuntime,
  type ThreePreviewRuntimeFactory,
} from './three-preview-runtime';
import {
  DEFAULT_THREE_SCENE_SOURCE,
  THREE_SCENE_MAX_SOURCE_LENGTH,
  THREE_SCENE_MONACO_GLOBAL_TYPES,
  THREE_SCENE_MONACO_MODULE_TYPES,
  type ThreeSceneError,
} from './three-source';
import classes from './ThreeSceneNode.module.css';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';

export type ThreeSceneMode = 'edit' | 'source' | 'preview';

export interface ThreeSceneLabels {
  title: string;
  edit: string;
  source: string;
  preview: string;
  run: string;
  stop: string;
  restart: string;
  apply: string;
  copy: string;
  resetOriginal: string;
  sourceInput: string;
  copied: string;
  running: string;
  stopped: string;
  error: string;
  resizeLeft: string;
  resizeRight: string;
}

export const THREE_SCENE_LABEL_KEYS = [
  'title',
  'edit',
  'source',
  'preview',
  'run',
  'stop',
  'restart',
  'apply',
  'copy',
  'resetOriginal',
  'sourceInput',
  'copied',
  'running',
  'stopped',
  'error',
  'resizeLeft',
  'resizeRight',
] as const satisfies readonly (keyof ThreeSceneLabels)[];

/** Compatibility exports only. Runtime node views require current-locale labels to be injected. */
export const DEFAULT_THREE_SCENE_LABELS = {
  title: 'Three.js scene',
  edit: 'Edit',
  source: 'Source',
  preview: 'Preview',
  run: 'Run',
  stop: 'Stop',
  restart: 'Restart',
  apply: 'Apply',
  copy: 'Copy',
  resetOriginal: 'Reset to original',
  sourceInput: 'Three.js source',
  copied: 'Copied',
  running: 'Running',
  stopped: 'Stopped',
  error: 'Error',
  resizeLeft: 'Resize from left',
  resizeRight: 'Resize from right',
} satisfies ThreeSceneLabels;
export const KOREAN_THREE_SCENE_LABELS = {
  title: 'Three.js 장면',
  edit: '편집',
  source: '소스',
  preview: '미리보기',
  run: '실행',
  stop: '중지',
  restart: '다시 실행',
  apply: '적용',
  copy: '복사',
  resetOriginal: '원본으로 재설정',
  sourceInput: 'Three.js 소스',
  copied: '복사됨',
  running: '실행 중',
  stopped: '중지됨',
  error: '오류',
  resizeLeft: '왼쪽에서 크기 조절',
  resizeRight: '오른쪽에서 크기 조절',
} satisfies ThreeSceneLabels;

function requireThreeSceneLabels(labels: Partial<ThreeSceneLabels> | undefined): ThreeSceneLabels {
  const missing = THREE_SCENE_LABEL_KEYS.filter((key) => !labels?.[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`ThreeScene labels are required: ${missing.join(', ')}`);
  }
  return labels as ThreeSceneLabels;
}

export interface ThreeSceneOptions {
  labels?: Partial<ThreeSceneLabels>;
  runtimeFactory?: ThreePreviewRuntimeFactory;
  autoRunReadOnly?: boolean;
  selectionMenuRegistry?: ExecutableSelectionMenuRegistry;
  selectionMenuLabels?: Pick<
    ExecutableSelectionMenuLabels,
    'deleteBlock' | 'alignment' | 'alignLeft' | 'alignCenter' | 'alignRight'
  >;
  authoringMode?: EditorAuthoringMode | null;
}

export interface InsertThreeSceneOptions {
  title?: string;
  source?: string;
  mode?: ThreeSceneMode;
  previewHeight?: number;
  previewWidth?: string;
  textAlignment?: ContextualBlockAlignment;
  blockId?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    threeScene: {
      insertThreeScene: (options?: InsertThreeSceneOptions) => ReturnType;
    };
  }
}

function normalizeMode(value: unknown): ThreeSceneMode {
  return value === 'source' || value === 'preview' ? value : 'edit';
}

function normalizePreviewHeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(720, Math.max(180, Math.round(parsed))) : 360;
}

function normalizePreviewWidth(value: unknown): string {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return String(Number.isFinite(parsed) ? Math.min(100, Math.max(10, Math.round(parsed))) : 100);
}

function normalizeAlignment(value: unknown): ContextualBlockAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

function makeBlockId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `three-${Date.now().toString(36)}`;
}

function registerThreeSceneMonacoTypes(_editor: MonacoEditor.IStandaloneCodeEditor, _monaco: Monaco) {
  let disposed = false;
  let disposeLibraries: (() => void) | undefined;
  void import('monaco-editor/language/typescript/monaco.contribution').then(({ typescriptDefaults }) => {
    if (disposed) {
      return;
    }
    const moduleTypes = typescriptDefaults.addExtraLib(
      THREE_SCENE_MONACO_MODULE_TYPES,
      'inmemory://model/node_modules/three/index.d.ts',
    );
    const globalTypes = typescriptDefaults.addExtraLib(
      THREE_SCENE_MONACO_GLOBAL_TYPES,
      'inmemory://model/editor/types/three-scene-globals.d.ts',
    );
    disposeLibraries = () => {
      moduleTypes.dispose();
      globalTypes.dispose();
    };
  });
  return () => {
    disposed = true;
    disposeLibraries?.();
  };
}

function formatError(error: ThreeSceneError): string {
  const location = error.line ? ` (${error.line}:${error.column ?? 1})` : '';
  return `${error.message}${location}`;
}

function ThreePreviewSurface({
  source,
  height,
  revision,
  active,
  runtimeFactory,
  labels,
  onRuntime,
}: {
  source: string;
  height: number;
  revision: number;
  active: boolean;
  runtimeFactory: ThreePreviewRuntimeFactory;
  labels: ThreeSceneLabels;
  onRuntime: (runtime: ThreePreviewRuntime | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runSource = useRef(source);
  const [status, setStatus] = useState<'starting' | 'running' | 'stopped' | 'error'>(active ? 'starting' : 'stopped');
  const [error, setError] = useState<ThreeSceneError | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!active || !canvas) {
      setStatus('stopped');
      return;
    }
    setStatus('starting');
    setError(null);
    const runtime = runtimeFactory(canvas, {
      onReady: () => setStatus('running'),
      onStopped: () => setStatus('stopped'),
      onError: (nextError) => {
        setError(nextError);
        setStatus('error');
      },
    });
    onRuntime(runtime);
    runtime.run(runSource.current);
    return () => {
      onRuntime(null);
      runtime.dispose();
    };
  }, [active, onRuntime, revision, runtimeFactory]);

  return (
    <div className={classes.preview} data-testid="three-preview" data-status={status} style={{ height }}>
      <div className={classes.canvasStage} data-testid="three-preview-stage">
        <canvas
          key={revision}
          ref={canvasRef}
          className={classes.canvas}
          width={1280}
          height={720}
          aria-label={labels.preview}
        />
      </div>
      <ExecutableRuntimeStatus status={status} running={labels.running} stopped={labels.stopped} />
      {error ? (
        <Alert className={classes.error} tone="danger" title={labels.error} data-testid="three-error">
          {formatError(error)}
        </Alert>
      ) : null}
    </div>
  );
}

export function ThreeSceneNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  labels: providedLabels,
  runtimeFactory = createThreePreviewWorkerRuntime,
  autoRunReadOnly = true,
  selectionMenuRegistry,
  selectionMenuLabels,
  authoringMode,
}: NodeViewProps & ThreeSceneOptions) {
  const labels = requireThreeSceneLabels(providedLabels);
  const editable = useTiptapEditorEditable(editor);
  const canEditNeutral = editable && authoringMode?.allowNeutralBlockEdits === true;
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditTitle = editable && authoringMode?.allowLocalizedBlockEdits === true;
  const authoringSelected = canEditNeutral && exactNodeSelected;
  const title = typeof node.attrs.title === 'string' ? node.attrs.title : '';
  const originalSource = node.textContent;
  const durableMode = normalizeMode(node.attrs.mode);
  const previewHeight = normalizePreviewHeight(node.attrs.previewHeight);
  const previewWidth = normalizePreviewWidth(node.attrs.previewWidth);
  const textAlignment = normalizeAlignment(node.attrs.textAlignment);
  const blockId = executableBlockIdForPosition({ editor, getPos });
  const containerRef = useRef<HTMLDivElement>(null);
  const [publicMode, setPublicMode] = useState<ThreeSceneMode>('preview');
  const [temporarySource, setTemporarySource] = useState(originalSource);
  const [draftSource, setDraftSource] = useState(originalSource);
  const [hasTemporaryFork, setHasTemporaryFork] = useState(false);
  const initialRunning = canEditNeutral ? durableMode !== 'source' : !editable && autoRunReadOnly;
  const [running, setRunning] = useState(initialRunning);
  const [revision, setRevision] = useState(initialRunning ? 1 : 0);
  const [copied, setCopied] = useState(false);
  const runtimeRef = useRef<ThreePreviewRuntime | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibilityPaused = useRef(false);
  const setRuntime = useCallback((runtime: ThreePreviewRuntime | null) => {
    runtimeRef.current = runtime;
  }, []);
  const mode = canEditNeutral ? durableMode : publicMode;
  const source = hasTemporaryFork ? temporarySource : originalSource;
  const appliedSourceRef = useRef(source);
  const hasDraftChanges = draftSource !== source;
  const codeVisible = mode !== 'preview';
  const previewVisible = true;
  const previousSource = useRef(source);
  const persistPreviewWidth = useCallback(
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
    onResize: persistPreviewWidth,
    keyboardSession: { owner: editor, key: `threeScene:${blockId}` },
  });

  useEffect(() => {
    if (!hasTemporaryFork) {
      setTemporarySource(originalSource);
    }
  }, [hasTemporaryFork, originalSource]);

  useEffect(() => {
    const previousAppliedSource = appliedSourceRef.current;
    appliedSourceRef.current = source;
    setDraftSource((current) => (current === previousAppliedSource ? source : current));
  }, [source]);

  useEffect(() => {
    if (editable || !hasTemporaryFork || mode !== 'edit') {
      return;
    }
    setRunning(true);
    setRevision((value) => value + 1);
  }, [editable, hasTemporaryFork, mode, temporarySource]);

  useEffect(() => {
    if (previousSource.current === source) {
      return;
    }
    previousSource.current = source;
    if (mode !== 'edit' || !canEditNeutral) {
      return;
    }
    setRunning(true);
    setRevision((value) => value + 1);
  }, [canEditNeutral, mode, source]);

  useEffect(
    () => () => {
      runtimeRef.current?.dispose();
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    },
    [],
  );

  const setMode = useCallback(
    (nextMode: ThreeSceneMode) => {
      visibilityPaused.current = false;
      if (editor.isEditable && authoringMode?.allowNeutralBlockEdits === true) {
        updateAttributes({ mode: nextMode });
      } else {
        setPublicMode(nextMode);
      }
      if (nextMode !== 'source') {
        setRunning(true);
        setRevision((value) => value + 1);
      } else {
        runtimeRef.current?.stop();
        setRunning(false);
      }
    },
    [authoringMode, editable, editor, updateAttributes],
  );

  const stop = useCallback(() => {
    visibilityPaused.current = false;
    runtimeRef.current?.stop();
    setRunning(false);
  }, []);
  const restart = useCallback(() => {
    visibilityPaused.current = false;
    setRunning(true);
    setRevision((value) => value + 1);
  }, []);
  const resetOriginal = useCallback(() => {
    const requiresSourceReset = temporarySource !== originalSource;
    setTemporarySource(originalSource);
    setDraftSource(originalSource);
    if (!requiresSourceReset) {
      restart();
    }
  }, [originalSource, restart, temporarySource]);
  const applyDraft = useCallback(() => {
    if (!hasDraftChanges) {
      return;
    }
    if (canEditNeutral) {
      replaceExecutableSource({ editor, getPos, node }, draftSource);
    } else if (!editable && hasTemporaryFork) {
      setTemporarySource(draftSource);
    }
  }, [canEditNeutral, draftSource, editable, editor, getPos, hasDraftChanges, hasTemporaryFork, node]);
  const toggleSource = useCallback(() => {
    if (codeVisible) {
      setMode('preview');
      return;
    }
    if (!editable && !hasTemporaryFork) {
      setHasTemporaryFork(true);
      setTemporarySource(originalSource);
      setDraftSource(originalSource);
    }
    setMode(canEditNeutral || !editable ? 'edit' : 'source');
  }, [canEditNeutral, codeVisible, editable, hasTemporaryFork, originalSource, setMode]);
  useEffect(() => {
    if (!previewVisible) {
      return;
    }
    const onVisibilityChange = () => {
      if (document.hidden && running) {
        visibilityPaused.current = true;
        runtimeRef.current?.stop();
        setRunning(false);
      } else if (!document.hidden && visibilityPaused.current) {
        visibilityPaused.current = false;
        restart();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [previewVisible, restart, running]);
  const copySource = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mode === 'edit' ? draftSource : source);
      setCopied(true);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = setTimeout(() => setCopied(false), 1_000);
    } catch {
      setCopied(false);
    }
  }, [draftSource, mode, source]);
  const selectBlock = useCallback(() => {
    if (!canEditNeutral) {
      return;
    }
    const position = getPos();
    if (typeof position !== 'number' || editor.state.doc.nodeAt(position)?.type.name !== 'threeScene') {
      return;
    }
    editor.commands.setNodeSelection(position);
    editor.view.focus();
  }, [canEditNeutral, editor, getPos]);
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
        blockType: 'threeScene',
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

  return (
    <NodeViewWrapper
      className={classes.node}
      data-content-type="threeScene"
      data-selected={authoringSelected || undefined}
      data-editor-mode={editable ? 'authoring' : 'public'}
      data-preview-width={previewWidth}
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

          <Stack className={classes.body} data-view-mode={mode} gap={0}>
            {previewVisible ? (
              <ThreePreviewSurface
                key={revision}
                source={source}
                height={previewHeight}
                revision={revision}
                active={running}
                runtimeFactory={runtimeFactory}
                labels={labels}
                onRuntime={setRuntime}
              />
            ) : null}

            <ExecutableRuntimeControls
              className={classes.controls}
              type="threeScene"
              labels={labels}
              running={running}
              onRun={restart}
              onStop={stop}
              onRestart={restart}
              sourceControl={{ label: labels.source, expanded: codeVisible, onClick: toggleSource }}
              onResetOriginal={codeVisible ? resetOriginal : undefined}
              resetDisabled={!hasDraftChanges && temporarySource === originalSource}
              copyControl={
                codeVisible ? { label: copied ? labels.copied : labels.copy, onClick: copySource } : undefined
              }
              applyControl={
                mode === 'edit' ? { label: labels.apply, disabled: !hasDraftChanges, onClick: applyDraft } : undefined
              }
            />

            {codeVisible ? (
              <Stack gap={0}>
                <MonacoSourceEditor
                  className={classes.editor}
                  value={mode === 'edit' ? draftSource : source}
                  language="typescript"
                  ariaLabel={labels.sourceInput}
                  modelPath={`three/${blockId}.ts`}
                  height={previewHeight}
                  maxLength={THREE_SCENE_MAX_SOURCE_LENGTH}
                  onMount={registerThreeSceneMonacoTypes}
                  onChange={mode === 'edit' ? setDraftSource : undefined}
                  onApply={mode === 'edit' ? applyDraft : undefined}
                  onEscape={canEditNeutral ? selectBlock : undefined}
                  readOnly={mode !== 'edit'}
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

export function createThreeSceneExtension(options: ThreeSceneOptions = {}): Extensions[number] {
  return Node.create<ThreeSceneOptions>({
    name: 'threeScene',
    group: 'blockContent',
    content: 'text*',
    marks: '',
    code: true,
    atom: true,
    defining: true,
    isolating: true,
    selectable: true,
    draggable: false,
    addOptions: () => options,
    addAttributes() {
      return {
        title: {
          default: '',
          parseHTML: (element) => element.getAttribute('data-title') ?? '',
          renderHTML: ({ title }) => ({ 'data-title': typeof title === 'string' ? title : '' }),
        },
        language: {
          default: 'typescript',
          parseHTML: () => 'typescript',
          renderHTML: () => ({ 'data-language': 'typescript' }),
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
      return [{ tag: '[data-content-type="threeScene"]' }];
    },
    renderHTML({ HTMLAttributes }) {
      return ['div', mergeAttributes(HTMLAttributes, { 'data-content-type': 'threeScene' }), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer((props) => <ThreeSceneNodeView {...props} {...this.options} />, {
        stopEvent: ({ event }) => isMonacoSourceEditorEvent(event),
      });
    },
    addCommands() {
      return {
        insertThreeScene:
          (input = {}) =>
          ({ commands, editor }: CommandProps) => {
            if (
              !editor.isEditable ||
              this.options.authoringMode?.allowNeutralBlockEdits !== true ||
              !editor.schema.nodes.blockContainer ||
              !editor.schema.nodes.threeScene
            ) {
              return false;
            }
            return commands.insertContent({
              type: 'blockContainer',
              attrs: { id: input.blockId ?? makeBlockId() },
              content: [
                {
                  type: 'threeScene',
                  attrs: {
                    title: input.title ?? '',
                    language: 'typescript',
                    mode: normalizeMode(input.mode),
                    previewHeight: normalizePreviewHeight(input.previewHeight),
                    previewWidth: normalizePreviewWidth(input.previewWidth),
                    textAlignment: normalizeAlignment(input.textAlignment),
                  },
                  content: [{ type: 'text', text: input.source ?? DEFAULT_THREE_SCENE_SOURCE }],
                },
              ],
            });
          },
      };
    },
  });
}
