'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor, JSONContent } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import { IconVariable } from '@tabler/icons-react';
import type { Awareness } from 'y-protocols/awareness';
import * as Y from 'yjs';
import { DropdownMenu } from '@/components/core/DropdownMenu';
import { normalizeRichTextHtmlLinks } from '@echovisionlab/geul-common/editor/link-normalization';
import { createCollaborationExtension } from '../collaboration';
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

export class UnsupportedEmailCampaignTiptapNodeError extends Error {
  constructor(nodeName: string) {
    super(`Unsupported email/campaign Tiptap node: ${nodeName}`);
    this.name = 'UnsupportedEmailCampaignTiptapNodeError';
  }
}

const SUPPORTED_XML_NODE_NAMES = new Set([
  'blockgroup',
  'blockcontainer',
  'paragraph',
  'heading',
  'bulletlistitem',
  'numberedlistitem',
  'checklistitem',
  'quote',
  'callout',
  'codeblock',
  'divider',
  'math',
  'map',
  'table',
  'tableparagraph',
  'tableheader',
  'tablecell',
  'tablerow',
  'hardbreak',
  'mathinline',
]);

function assertSupportedXmlNodes(node: Y.XmlFragment | Y.XmlElement): void {
  for (const child of node.toArray()) {
    if (!(child instanceof Y.XmlElement)) {
      continue;
    }
    const nodeName = child.nodeName.toLocaleLowerCase();
    if (!SUPPORTED_XML_NODE_NAMES.has(nodeName)) {
      throw new UnsupportedEmailCampaignTiptapNodeError(child.nodeName);
    }
    assertSupportedXmlNodes(child);
  }
}

/** Validates both initial content and remote collaborative updates before rendering them. */
export function findUnsupportedEmailCampaignTiptapNode(fragment: Y.XmlFragment): string | null {
  try {
    assertSupportedXmlNodes(fragment);
    return null;
  } catch (error) {
    if (error instanceof UnsupportedEmailCampaignTiptapNodeError) {
      return error.message;
    }
    throw error;
  }
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

export type EmailTiptapEditorProps = EmailTiptapEditorSharedProps &
  (
    | {
        blockRoomController: RichTextBlockRoomTiptapController;
        awareness: Awareness;
        userName: string;
        userColor: string;
        fragment?: never;
      }
    | {
        blockRoomController?: never;
        fragment: Y.XmlFragment;
        awareness?: Awareness;
        userName?: string;
        userColor?: string;
      }
  );

const IsolatedEditorContent = memo(({ editor }: { editor: Editor }) => {
  return <EditorContent editor={editor} className={classes.surface} />;
});
IsolatedEditorContent.displayName = 'IsolatedEditorContent';

function EmailTiptapEditorRuntime({
  fragment,
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
      ...(blockRoomController
        ? [
            blockRoomController.extension,
            createBlockRoomPresenceExtension(awareness!, { name: userName!, color: userColor! }),
          ]
        : [createCollaborationExtension({ fragment: fragment!, awareness })]),
    ],
    [awareness, blockRoomController, fragment, structureLocked, userColor, userName],
  );
  const editor = useEditor(
    {
      extensions,
      content: blockRoomController?.initialContent,
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
    if (!editor || !blockRoomController) {
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
  const legacyFragment = props.fragment;
  const [supportError, setSupportError] = useState(() =>
    legacyFragment ? findUnsupportedEmailCampaignTiptapNode(legacyFragment) : null,
  );

  useEffect(() => {
    if (!legacyFragment) {
      return;
    }
    const validate = () => setSupportError(findUnsupportedEmailCampaignTiptapNode(legacyFragment));
    validate();
    legacyFragment.observeDeep(validate);
    return () => legacyFragment.unobserveDeep(validate);
  }, [legacyFragment]);

  if (supportError) {
    return (
      <div role="alert" data-testid="email-campaign-tiptap-unsupported-node" data-editor-engine="tiptap">
        {supportError}
      </div>
    );
  }

  return <EmailTiptapEditorRuntime {...props} />;
}
