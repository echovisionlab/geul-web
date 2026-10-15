'use client';

import { useColorScheme } from '@/lib/providers/DesignSystemProvider';
import { themeIds } from '@/lib/theme/themes';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

import { registerGlslLanguage } from './glsl-language';
import type {
  MonacoSourceEditorProps,
  SourceEditorLanguage,
  SourceEditorMarker,
  SourceEditorMarkerSeverity,
} from './MonacoSourceEditor';
import './monaco-local';
import classes from './MonacoSourceEditor.module.css';
import { sourceEditorOptions, sourceEditorTheme, sourceEditorThemeName } from './source-editor-presentation';

const MARKER_SEVERITY: Record<SourceEditorMarkerSeverity, number> = {
  error: 8,
  warning: 4,
  info: 2,
  hint: 1,
};

export function normalizeMonacoModelPath(modelPath: string, language: SourceEditorLanguage): string {
  const trimmed = modelPath.trim();
  if (!trimmed) {
    throw new Error('MonacoSourceEditor modelPath must not be empty');
  }
  if (trimmed.startsWith('inmemory://')) {
    return trimmed;
  }
  const extension = language === 'typescript' ? 'ts' : language === 'javascript' ? 'js' : 'glsl';
  const filePath = trimmed.startsWith('file://') ? new URL(trimmed).pathname : trimmed;
  const normalized = filePath.replace(/^\/+/, '').replace(/\\/g, '/');
  const relativePath = normalized.startsWith('tiptap/') ? normalized.slice('tiptap/'.length) : normalized;
  return `inmemory://model/tiptap/${relativePath.includes('.') ? relativePath : `${relativePath}.${extension}`}`;
}

function markerData(marker: SourceEditorMarker): editor.IMarkerData {
  return {
    ...marker,
    endLineNumber: marker.endLineNumber ?? marker.startLineNumber,
    endColumn: marker.endColumn ?? marker.startColumn + 1,
    severity: MARKER_SEVERITY[marker.severity],
  };
}

export function MonacoSourceEditorRuntime({
  value,
  onChange,
  onUndo,
  onRedo,
  onEscape,
  onApply,
  language,
  readOnly = false,
  ariaLabel,
  modelPath,
  height = 320,
  editorOptions,
  density = 'standard',
  loading,
  maxLength,
  markers = [],
  onMount,
}: MonacoSourceEditorProps) {
  const { themeId } = useColorScheme();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [fontMetrics, setFontMetrics] = useState({ rootFontSize: 16, fontFamily: 'monospace' });
  useEffect(() => {
    const rootStyle = getComputedStyle(document.documentElement);
    setFontMetrics({
      rootFontSize: Number.parseFloat(rootStyle.fontSize) || 16,
      fontFamily: rootStyle.getPropertyValue('--font-mono').trim() || 'monospace',
    });
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const update = () => setReducedMotion(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const handleBeforeMount = useCallback((monaco: Monaco) => {
    registerGlslLanguage(monaco);
    for (const id of themeIds) {
      monaco.editor.defineTheme(sourceEditorThemeName(id), sourceEditorTheme(id));
    }
  }, []);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const acceptedValueRef = useRef(value);
  const suppressChangeRef = useRef(false);
  const consumerCleanupRef = useRef<(() => void) | null>(null);
  const internalCleanupRef = useRef<(() => void) | null>(null);
  const disposedRef = useRef(true);
  const markerOwner = useMemo(() => `tiptap-source-editor:${modelPath}`, [modelPath]);
  const resolvedPath = useMemo(() => normalizeMonacoModelPath(modelPath, language), [language, modelPath]);

  const clearMountedResources = useCallback(() => {
    if (disposedRef.current) {
      return;
    }
    disposedRef.current = true;
    consumerCleanupRef.current?.();
    consumerCleanupRef.current = null;
    internalCleanupRef.current?.();
    internalCleanupRef.current = null;
    const model = editorRef.current?.getModel();
    if (model && !model.isDisposed()) {
      monacoRef.current?.editor.setModelMarkers(model, markerOwner, []);
    }
    editorRef.current = null;
    monacoRef.current = null;
  }, [markerOwner]);

  const applyMarkers = useCallback(
    (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      const model = editorInstance.getModel();
      if (!model || model.isDisposed()) {
        return;
      }
      monaco.editor.setModelMarkers(model, markerOwner, markers.map(markerData));
    },
    [markerOwner, markers],
  );

  useEffect(() => {
    acceptedValueRef.current = value;
  }, [value]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    const monaco = monacoRef.current;
    if (editorInstance && monaco) {
      applyMarkers(editorInstance, monaco);
    }
  }, [applyMarkers]);

  useEffect(() => clearMountedResources, [clearMountedResources]);

  const handleMount = useCallback<OnMount>(
    (editorInstance, monaco) => {
      clearMountedResources();
      disposedRef.current = false;
      editorRef.current = editorInstance;
      monacoRef.current = monaco;
      applyMarkers(editorInstance, monaco);
      const cleanup = onMount?.(editorInstance, monaco);
      consumerCleanupRef.current = typeof cleanup === 'function' ? cleanup : null;

      // Shared history and source-boundary shortcuts belong to this adapter.
      // Navigation, selection, indentation and editing remain native Monaco commands.
      if (onUndo) {
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ, onUndo);
      }
      if (onRedo) {
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ, onRedo);
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY, onRedo);
      }
      if (onApply) {
        editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, onApply);
      }
      if (onEscape) {
        // Monaco owns cancellation inside its completion, find, rename and
        // snippet UI. Exit the containing source block only after those close.
        editorInstance.addCommand(
          monaco.KeyCode.Escape,
          onEscape,
          'editorTextFocus && !suggestWidgetVisible && !findWidgetVisible && !renameInputVisible && !parameterHintsVisible && !inSnippetMode',
        );
      }

      const editorDom = editorInstance.getDomNode();
      const routeHistoryInput = (event: Event) => {
        if (!(event instanceof InputEvent)) {
          return;
        }
        if (event.inputType === 'historyUndo' && onUndo) {
          event.preventDefault();
          onUndo();
        } else if (event.inputType === 'historyRedo' && onRedo) {
          event.preventDefault();
          onRedo();
        }
      };
      // Do not stop native keyboard events here. Monaco's EditContext relies on
      // its own event path for navigation and text deletion. Tiptap NodeViews
      // isolate Monaco events through their stopEvent contract instead.
      editorDom?.addEventListener('beforeinput', routeHistoryInput, true);
      internalCleanupRef.current = () => {
        editorDom?.removeEventListener('beforeinput', routeHistoryInput, true);
      };
      editorInstance.onDidDispose(clearMountedResources);
    },
    [applyMarkers, clearMountedResources, onApply, onEscape, onMount, onRedo, onUndo],
  );

  const handleChange = useCallback(
    (nextValue: string | undefined, event: editor.IModelContentChangedEvent) => {
      if (suppressChangeRef.current) {
        suppressChangeRef.current = false;
        return;
      }
      const next = nextValue ?? '';
      if (typeof maxLength === 'number' && next.length > maxLength) {
        const model = editorRef.current?.getModel();
        if (model && !model.isDisposed()) {
          suppressChangeRef.current = true;
          // Every accepted bounded edit closes an undo element below. Undoing
          // here therefore removes only this rejected edit, and Monaco restores
          // the exact pre-edit cursor/selection. The resulting model event is
          // suppressed and never reaches the owning draft.
          void model.undo();
        }
        return;
      }
      acceptedValueRef.current = next;
      if (typeof maxLength === 'number' && !event.isUndoing && !event.isRedoing) {
        // Monaco groups adjacent typing by default. Close that group only for
        // bounded editors so the next over-limit change can be rejected without
        // rolling an already-published draft change back with it.
        editorRef.current?.getModel()?.pushStackElement();
      }
      onChange?.(next, {
        value: next,
        changes: event.changes.map(({ rangeOffset, rangeLength, text }) => ({
          rangeOffset,
          rangeLength,
          text,
        })),
        isUndoing: event.isUndoing,
        isRedoing: event.isRedoing,
        versionId: event.versionId,
      });
    },
    [maxLength, onChange],
  );

  return (
    <Editor
      value={value}
      language={language}
      path={resolvedPath}
      theme={sourceEditorThemeName(themeId)}
      height={height}
      keepCurrentModel={false}
      saveViewState={false}
      beforeMount={handleBeforeMount}
      onMount={handleMount}
      onChange={handleChange}
      options={{
        ...sourceEditorOptions({ density, reducedMotion, ...fontMetrics, behavior: editorOptions }),
        ariaLabel,
        domReadOnly: readOnly,
        readOnly,
      }}
      loading={loading ?? <div className={classes.loading}>{ariaLabel}</div>}
    />
  );
}
