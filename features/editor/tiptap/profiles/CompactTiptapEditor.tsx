'use client';

import { memo, useEffect, useMemo, useRef } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { useRegisterEditorAuthoringMode, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { TranslationStructureLockExtension } from '@/lib/editor/extensions/TranslationStructureLockExtension';
import type { RichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { createBlockRoomPresenceExtension } from '../block-room-presence';
import { createCollaborationExtension } from '../collaboration';
import { createAuthoringShortcutGuard } from '../integration/authoring-shortcuts';
import {
  WireBackgroundColor,
  WireBlockContainer,
  WireBlockGroup,
  WireBold,
  WireCode,
  WireDivider,
  WireDocument,
  WireHardBreak,
  WireItalic,
  TiptapKeyboardShortcuts,
  WireLink,
  WireParagraph,
  WireStrike,
  WireText,
  WireTextColor,
  WireUnderline,
} from '../wire-schema';
import editorClasses from '../TiptapEditor.module.css';
import classes from './CompactTiptapEditor.module.css';

const IsolatedEditorContent = memo(({ editor }: { editor: Editor | null }) => (
  <EditorContent editor={editor} className={editorClasses.surface} />
));
IsolatedEditorContent.displayName = 'IsolatedEditorContent';

/**
 * The profile-only schema deliberately matches the existing collaboration wire
 * shape, while accepting only the nodes and marks the bio schema allowed.
 */
export function createCompactTiptapExtensions(placeholder: string, structureLocked = false) {
  return [
    WireDocument,
    WireBlockGroup,
    WireBlockContainer,
    WireParagraph,
    WireDivider,
    WireText,
    WireHardBreak,
    WireBold,
    WireItalic,
    WireUnderline,
    WireStrike,
    WireCode,
    WireTextColor,
    WireBackgroundColor,
    WireLink,
    TiptapKeyboardShortcuts,
    createCompactPlaceholderExtension(placeholder),
    ...(structureLocked ? [TranslationStructureLockExtension] : []),
  ];
}

export function resolveCompactEditorAuthoringMode(isEditable: boolean, structureLocked: boolean): EditorAuthoringMode {
  return {
    allowNeutralBlockEdits: isEditable && !structureLocked,
    allowLocalizedBlockEdits: isEditable,
  };
}

function createCompactPlaceholderExtension(placeholder: string) {
  return Extension.create({
    name: 'compactPlaceholder',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          props: {
            decorations: (state) => {
              const decorations: Decoration[] = [];
              state.doc.descendants((node, position) => {
                if (node.type.name === 'paragraph' && node.content.size === 0) {
                  decorations.push(
                    Decoration.node(position, position + node.nodeSize, {
                      class: classes.empty,
                      'data-placeholder': placeholder,
                    }),
                  );
                }
              });
              return DecorationSet.create(state.doc, decorations);
            },
          },
        }),
      ];
    },
  });
}

interface CompactTiptapEditorSharedProps {
  editable?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  userName?: string;
  userColor?: string;
  className?: string;
  onChange?: (editor: Editor) => void;
  structureLocked?: boolean;
}

export type CompactTiptapEditorProps = CompactTiptapEditorSharedProps &
  (
    | {
        blockRoomController: RichTextBlockRoomTiptapController;
        awareness: Awareness;
        fragment?: never;
      }
    | {
        blockRoomController?: never;
        fragment: Y.XmlFragment;
        awareness?: Awareness;
      }
  );

export function CompactTiptapEditor({
  fragment,
  blockRoomController,
  awareness,
  editable = true,
  readOnly = false,
  placeholder = '',
  userName,
  userColor,
  className,
  onChange,
  structureLocked = false,
}: CompactTiptapEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isEditable = editable && !readOnly;
  const authoringMode = useMemo<EditorAuthoringMode>(
    () => resolveCompactEditorAuthoringMode(isEditable, structureLocked),
    [isEditable, structureLocked],
  );
  const extensions = useMemo(
    () => [
      ...createCompactTiptapExtensions(placeholder, structureLocked),
      createAuthoringShortcutGuard(authoringMode),
      ...(blockRoomController
        ? [
            blockRoomController.extension,
            ...(awareness && userName && userColor
              ? [createBlockRoomPresenceExtension(awareness, { name: userName, color: userColor })]
              : []),
          ]
        : [createCollaborationExtension({ fragment: fragment!, awareness })]),
    ],
    [authoringMode, awareness, blockRoomController, fragment, placeholder, structureLocked, userColor, userName],
  );
  const editor = useEditor(
    {
      extensions,
      content: blockRoomController?.initialContent,
      editable: isEditable,
      immediatelyRender: false,
      shouldRerenderOnTransaction: false,
      onUpdate: ({ editor: updatedEditor }) => onChangeRef.current?.(updatedEditor),
      editorProps: {
        attributes: {
          class: `editor-content ${editorClasses.content} ${classes.content}`,
          'data-testid': 'compact-tiptap-editor-content',
        },
      },
    },
    [extensions],
  );
  useRegisterEditorAuthoringMode(editor, authoringMode);

  useEffect(() => {
    if (!editor || !blockRoomController) {
      return;
    }
    return blockRoomController.connect(editor);
  }, [blockRoomController, editor]);

  useEffect(() => {
    editor?.setEditable(isEditable);
  }, [editor, isEditable]);

  useEffect(() => {
    if (!awareness || !userName || !userColor) {
      return;
    }
    awareness.setLocalStateField('user', { name: userName, color: userColor });
  }, [awareness, userColor, userName]);

  return (
    <div
      className={[editorClasses.editor, 'tiptap-editor', className].filter(Boolean).join(' ')}
      data-editor-engine="tiptap"
      data-profile="compact"
    >
      <IsolatedEditorContent editor={editor} />
    </div>
  );
}
