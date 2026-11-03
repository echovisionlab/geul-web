'use client';

import { PageLoader } from '@/features/site/PageLoader';
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import classes from './MonacoSourceEditor.module.css';
import type { SourceEditorBehaviorOptions, SourceEditorDensity } from './source-editor-presentation';

/** Monaco language id. JavaScript, TypeScript and local GLSL are first-class. */
export type SourceEditorLanguage = 'javascript' | 'typescript' | 'glsl' | (string & {});
export type SourceEditorMarkerSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface SourceEditorMarker {
  message: string;
  severity: SourceEditorMarkerSeverity;
  startLineNumber: number;
  startColumn: number;
  endLineNumber?: number;
  endColumn?: number;
  code?: string;
  source?: string;
}

export interface SourceEditorTextChange {
  rangeOffset: number;
  rangeLength: number;
  text: string;
}

export interface SourceEditorChange {
  value: string;
  changes: readonly SourceEditorTextChange[];
  isUndoing: boolean;
  isRedoing: boolean;
  versionId: number;
}

export interface MonacoSourceEditorProps {
  value: string;
  onChange?: (value: string, change: SourceEditorChange) => void;
  /** Routes Monaco's undo keybindings to the owning ProseMirror/Yjs history. */
  onUndo?: () => void;
  /** Routes Monaco's redo keybindings to the owning ProseMirror/Yjs history. */
  onRedo?: () => void;
  /** Exits source editing without mutating source, cursor or durable view mode. */
  onEscape?: () => void;
  /** Applies an executable block's local draft with Mod+Enter. */
  onApply?: () => void;
  language: SourceEditorLanguage;
  readOnly?: boolean;
  ariaLabel: string;
  /** Stable, caller-owned identity such as `p5/<block-id>.js`. */
  modelPath: string;
  height?: number | string;
  /** Shared text/density scale. No arbitrary font or padding overrides. */
  density?: SourceEditorDensity;
  editorOptions?: SourceEditorBehaviorOptions;
  loading?: ReactNode;
  bordered?: boolean;
  maxLength?: number;
  markers?: readonly SourceEditorMarker[];
  className?: string;
  onMount?: (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => void | (() => void);
}

const MonacoSourceEditorRuntime = lazy(async () => {
  const runtime = await import('./MonacoSourceEditorRuntime');
  return { default: runtime.MonacoSourceEditorRuntime };
});

export function MonacoSourceEditor(props: MonacoSourceEditorProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const { bordered = true, className, height = 320, language, loading } = props;
  const rootClassName = bordered ? classes.root : `${classes.root} ${classes.unframed}`;
  const wrapperClassName = className ? `${rootClassName} ${className}` : rootClassName;
  const placeholder = loading ?? <PageLoader placement="flow" height="100%" minHeight={0} />;
  return (
    <div
      className={wrapperClassName}
      role="group"
      aria-label={props.ariaLabel}
      data-testid="tiptap-monaco-source-editor"
      data-source-editor="monaco"
      dir="ltr"
      data-language={language}
      data-density={props.density ?? 'standard'}
      style={{ height }}
    >
      <Suspense fallback={placeholder}>
        {/* SSR and the initial hydration pass keep the same surface without importing the browser engine. */}
        {mounted ? <MonacoSourceEditorRuntime {...props} loading={placeholder} className={undefined} /> : placeholder}
      </Suspense>
    </div>
  );
}
