'use client';

import { lazy, Suspense, type ReactNode } from 'react';
import type { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import classes from './MonacoSourceEditor.module.css';

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
  editorOptions?: editor.IStandaloneEditorConstructionOptions;
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
  const { ariaLabel, bordered = true, className, height = 320, language, loading } = props;
  const rootClassName = bordered ? classes.root : `${classes.root} ${classes.unframed}`;
  const wrapperClassName = className ? `${rootClassName} ${className}` : rootClassName;
  return (
    <div
      className={wrapperClassName}
      data-testid="tiptap-monaco-source-editor"
      data-source-editor="monaco"
      data-language={language}
      style={{ height }}
    >
      <Suspense fallback={loading ?? <div className={classes.loading}>{ariaLabel}</div>}>
        <MonacoSourceEditorRuntime {...props} className={undefined} />
      </Suspense>
    </div>
  );
}
