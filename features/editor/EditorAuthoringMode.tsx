'use client';

import { createContext, useContext, useEffect, type ReactNode } from 'react';

export interface EditorAuthoringMode {
  allowNeutralBlockEdits: boolean;
  allowLocalizedBlockEdits: boolean;
  applyNeutralBlockProps?: (blockId: string, props: Record<string, unknown>) => void;
  deleteNeutralBlock?: (blockId: string) => void;
}

const DEFAULT_EDITOR_AUTHORING_MODE: EditorAuthoringMode = {
  allowNeutralBlockEdits: true,
  allowLocalizedBlockEdits: true,
};

/**
 * Provider absence is distinct from the legacy default used by the required
 * hook. Tiptap integrators use the optional hook and must opt into mutation
 * authority explicitly.
 */
const EditorAuthoringModeContext = createContext<EditorAuthoringMode | null>(null);

const editorAuthoringModeRegistry = new WeakMap<object, EditorAuthoringMode>();

interface EditorAuthoringModeProviderProps {
  value: EditorAuthoringMode;
  children: ReactNode;
}

export function EditorAuthoringModeProvider({ value, children }: EditorAuthoringModeProviderProps) {
  return <EditorAuthoringModeContext.Provider value={value}>{children}</EditorAuthoringModeContext.Provider>;
}

export function useEditorAuthoringMode(): EditorAuthoringMode {
  return useContext(EditorAuthoringModeContext) ?? DEFAULT_EDITOR_AUTHORING_MODE;
}

/**
 * Returns `null` unless an owning provider explicitly grants authoring
 * authority. Use this at optional/integrator boundaries to fail closed.
 */
export function useOptionalEditorAuthoringMode(): EditorAuthoringMode | null {
  return useContext(EditorAuthoringModeContext);
}

export function resolveEditorAuthoringMode(editor: object | null | undefined): EditorAuthoringMode {
  if (!editor) {
    return DEFAULT_EDITOR_AUTHORING_MODE;
  }
  return editorAuthoringModeRegistry.get(editor) ?? DEFAULT_EDITOR_AUTHORING_MODE;
}

export function useRegisterEditorAuthoringMode(editor: object | null | undefined, value: EditorAuthoringMode) {
  useEffect(() => {
    if (!editor) {
      return;
    }

    editorAuthoringModeRegistry.set(editor, value);
    return () => {
      const currentValue = editorAuthoringModeRegistry.get(editor);
      if (currentValue === value) {
        editorAuthoringModeRegistry.delete(editor);
      }
    };
  }, [editor, value]);
}
