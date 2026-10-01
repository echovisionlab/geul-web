'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { IconVariable } from '@tabler/icons-react';
import type { Awareness } from 'y-protocols/awareness';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { normalizeRichTextHtmlLinks } from '@echovisionlab/geul-common/editor/link-normalization';
import { createBlockRoomPresenceExtension } from '../block-room-presence';
import type { RichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { TiptapAuthoringControls } from '../TiptapAuthoringControls';
import { createTiptapWireExtensions } from '../wire-schema';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';
import classes from '../TiptapEditor.module.css';

/**
 * The only imperative surface email and campaign previews need.  Keep this
 * independent of the collaborative editor so consumers cannot couple the profiles.
 */
export interface EmailCampaignTiptapEditorHandle {
  getJSON: () => JSONContent;
  getHTML: () => string;
  getText: () => string;
  insertVariable: (variable: string) => void;
  focus: () => void;
}

export function normalizeEmailCampaignVariable(variable: string): string {
  const trimmed = variable.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('{{') && trimmed.endsWith('}}') ? trimmed : `{{${trimmed}}}`;
}

export function normalizeEmailCampaignPreviewHtml(html: string): string {
  return normalizeRichTextHtmlLinks(html);
}

function createHandle(editor: Editor): EmailCampaignTiptapEditorHandle {
  return {
    getJSON: () => editor.getJSON(),
    getHTML: () => normalizeEmailCampaignPreviewHtml(editor.getHTML()),
    getText: () => editor.getText(),
    insertVariable: (variable) => {
      const value = normalizeEmailCampaignVariable(variable);
      if (value) {
        editor.chain().focus().insertContent(value).run();
      }
    },
    focus: () => editor.chain().focus().run(),
  };
}

interface VariableInserterProps {
  availableVariables?: string[];
  onInsert: (variable: string) => void;
}

function VariableInserter({ availableVariables, onInsert }: VariableInserterProps) {
  const variables = useMemo(() => {
    const source = availableVariables?.length ? availableVariables : ['site_name', 'site_origin', 'recipient_name'];
    return [...new Set(source.map((variable) => variable.trim().toLocaleLowerCase()).filter(Boolean))];
  }, [availableVariables]);

  return (
    <DropdownMenu size="expanded">
      <DropdownMenu.Target>
        <button type="button" className="email-tiptap-editor__variable-button" aria-label="Insert variable">
          <IconVariable size={18} />
        </button>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        {variables.map((variable) => (
          <DropdownMenu.Item key={variable} onClick={() => onInsert(variable)}>
            <code>{`{{${variable}}}`}</code>
          </DropdownMenu.Item>
        ))}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}

interface EmailTiptapEditorSharedProps {
  editable?: boolean;
  structureLocked?: boolean;
  availableVariables?: string[];
  className?: string;
  onEditorReady?: (editor: EmailCampaignTiptapEditorHandle) => void;
  onContentChange?: (editor: EmailCampaignTiptapEditorHandle) => void;
}

export interface EmailTiptapEditorProps extends EmailTiptapEditorSharedProps {
  blockRoomController: RichTextBlockRoomTiptapController;
  awareness: Awareness;
  userName: string;
  userColor: string;
}

const IsolatedEditorContent = memo(({ editor }: { editor: Editor }) => {
  return <EditorContent editor={editor} className={classes.surface} />;
});
IsolatedEditorContent.displayName = 'IsolatedEditorContent';

function EmailTiptapEditorRuntime({
  blockRoomController,
  awareness,
  userName,
  userColor,
  editable = true,
  structureLocked = false,
  availableVariables,
  className,
  onEditorReady,
  onContentChange,
}: EmailTiptapEditorProps) {
  const readyCallbackRef = useRef(onEditorReady);
  const changeCallbackRef = useRef(onContentChange);
  readyCallbackRef.current = onEditorReady;
  changeCallbackRef.current = onContentChange;
  const extensions = useMemo(
    () => [
      ...createTiptapWireExtensions(),
      ...(structureLocked ? [TranslationStructureLockExtension] : []),
      blockRoomController.extension,
      createBlockRoomPresenceExtension(awareness, { name: userName, color: userColor }),
    ],
    [awareness, blockRoomController, structureLocked, userColor, userName],
  );
  const editor = useEditor(
    {
      extensions,
      content: blockRoomController.initialContent,
      editable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      editorProps: {
        attributes: {
          class: `editor-content ${classes.content}`,
          'data-testid': 'email-campaign-tiptap-editor-content',
        },
      },
      onCreate: ({ editor: currentEditor }) => readyCallbackRef.current?.(createHandle(currentEditor)),
      onUpdate: ({ editor: currentEditor }) => changeCallbackRef.current?.(createHandle(currentEditor)),
    },
    [extensions],
  );
  useEffect(() => {
    if (!editor) {
      return;
    }
    return blockRoomController.connect(editor);
  }, [blockRoomController, editor]);

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return null;
  }

  const handle = createHandle(editor);
  return (
    <div className={[classes.editor, 'tiptap-editor', className].filter(Boolean).join(' ')} data-editor-engine="tiptap">
      {editable ? <VariableInserter availableVariables={availableVariables} onInsert={handle.insertVariable} /> : null}
      <TiptapAuthoringControls editor={editor} />
      <IsolatedEditorContent editor={editor} />
    </div>
  );
}

export function EmailTiptapEditor(props: EmailTiptapEditorProps) {
  return <EmailTiptapEditorRuntime {...props} />;
}
