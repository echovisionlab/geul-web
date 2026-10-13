'use client';

import { type Editor, type Extensions, type JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useLocale, useTranslations } from 'next-intl';

const IsolatedEditorContent = memo(({ editor }: { editor: Editor | null }) => (
  <EditorContent editor={editor} className="tiptap-editor__surface" />
));
IsolatedEditorContent.displayName = 'IsolatedEditorContent';

interface ControlledTiptapEditorProps {
  accessibleLabel?: string;
  /** Existing descriptive content owned by the surrounding field. */
  accessibleDescriptionId?: string;
  /** Identity of the actual editable surface, distinct from its layout wrapper. */
  contentId?: string;
  contentLanguage?: string;
  value: string;
  extensions: Extensions;
  parseValue: (value: string) => JSONContent;
  serializeValue: (document: JSONContent) => string;
  onChange: (value: string) => void;
  normalizeValue?: (value: string) => string;
  className?: string;
  contentClassName?: string;
  contentTestId?: string;
  onEditorReady?: (editor: Editor | null) => void;
  profile: string;
}

/** Shared controlled-value lifecycle for small standalone Tiptap fields. */
export function ControlledTiptapEditor({
  accessibleLabel,
  accessibleDescriptionId,
  contentId,
  contentLanguage,
  value,
  extensions,
  parseValue,
  serializeValue,
  onChange,
  normalizeValue = (current) => current,
  className,
  contentClassName,
  contentTestId,
  onEditorReady,
  profile,
}: ControlledTiptapEditorProps) {
  const interfaceLocale = useLocale();
  const labels = useTranslations('common.labels');
  const editorAttributes = useMemo(
    () => ({
      class: contentClassName ?? '',
      ...(contentTestId ? { 'data-testid': contentTestId } : {}),
      ...(contentId ? { id: contentId } : {}),
      role: 'textbox',
      'aria-label': accessibleLabel ?? labels('content'),
      ...(accessibleDescriptionId ? { 'aria-describedby': accessibleDescriptionId } : {}),
      'aria-multiline': 'true',
      lang: contentLanguage ?? interfaceLocale,
    }),
    [
      accessibleDescriptionId,
      accessibleLabel,
      contentClassName,
      contentId,
      contentLanguage,
      contentTestId,
      interfaceLocale,
      labels,
    ],
  );
  const valueRef = useRef(value);
  valueRef.current = value;
  const applyingExternalValue = useRef(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const editor = useEditor(
    {
      extensions,
      content: parseValue(value),
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: editorAttributes,
      },
      onUpdate: ({ editor: updatedEditor }) => {
        if (applyingExternalValue.current) {
          return;
        }
        const nextValue = serializeValue(updatedEditor.getJSON());
        if (nextValue !== normalizeValue(valueRef.current)) {
          onChangeRef.current(nextValue);
        }
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
      editor.setOptions({ editorProps: { ...editor.options.editorProps, attributes: editorAttributes } });
    }
  }, [editor, editorAttributes]);

  useEffect(() => {
    onEditorReady?.(editor);
    return () => onEditorReady?.(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const nextValue = normalizeValue(value);
    if (nextValue === serializeValue(editor.getJSON())) {
      return;
    }
    applyingExternalValue.current = true;
    editor.commands.setContent(parseValue(nextValue), { emitUpdate: false });
    applyingExternalValue.current = false;
  }, [editor, normalizeValue, parseValue, serializeValue, value]);

  return (
    <div
      className={['tiptap-editor', className].filter(Boolean).join(' ')}
      data-editor-engine="tiptap"
      data-profile={profile}
    >
      <IsolatedEditorContent editor={editor} />
    </div>
  );
}
