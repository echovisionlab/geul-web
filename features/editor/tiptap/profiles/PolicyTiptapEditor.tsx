'use client';

import { DEFAULT_SITE_BRAND_COLOR } from '@/lib/theme/site-brand';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Awareness } from 'y-protocols/awareness';
import type { RichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { EditorAuthoringModeProvider, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { tiptapDocumentToHtml, type TiptapHtmlOptions } from './profile-html';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import type { TiptapAuthoringCapabilities } from '@/features/editor/tiptap/TiptapAuthoringControls';

export type PolicyTiptapEditorInstance = Editor;

const POLICY_NODE_NAMES = new Set([
  'doc',
  'blockGroup',
  'blockContainer',
  'paragraph',
  'heading',
  'bulletListItem',
  'numberedListItem',
  'checkListItem',
  'quote',
  'callout',
  'codeBlock',
  'divider',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'tableParagraph',
  'text',
  'hardBreak',
  'siteVariable',
]);

const POLICY_MARK_NAMES = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'link',
  'textColor',
  'backgroundColor',
]);

/** Returns a user-safe error instead of silently dropping policy content. */
export function validatePolicyTiptapDocument(document: ProseMirrorNode): string | null {
  const unsupportedNodes = new Set<string>();
  const unsupportedMarks = new Set<string>();

  document.descendants((node) => {
    if (!POLICY_NODE_NAMES.has(node.type.name)) {
      unsupportedNodes.add(node.type.name);
    }
    for (const mark of node.marks) {
      if (!POLICY_MARK_NAMES.has(mark.type.name)) {
        unsupportedMarks.add(mark.type.name);
      }
    }
  });

  if (unsupportedNodes.size === 0 && unsupportedMarks.size === 0) {
    return null;
  }

  const details = [
    ...(unsupportedNodes.size > 0 ? [`nodes: ${[...unsupportedNodes].sort().join(', ')}`] : []),
    ...(unsupportedMarks.size > 0 ? [`styles: ${[...unsupportedMarks].sort().join(', ')}`] : []),
  ];
  return `This policy contains content that the policy editor does not support (${details.join('; ')}). Remove or migrate it before editing.`;
}

function createPolicyContentGuard(report: (message: string) => void) {
  return Extension.create({
    name: 'policyContentGuard',
    priority: 1100,
    addProseMirrorPlugins() {
      return [
        new Plugin({
          filterTransaction(transaction) {
            const error = validatePolicyTiptapDocument(transaction.doc);
            if (!error) {
              return true;
            }
            report(error);
            return false;
          },
        }),
      ];
    },
  });
}

/** Serializes the durable policy JSON to public policy HTML. */
export function policyTiptapDocumentToHtml(document: ProseMirrorNode, options: TiptapHtmlOptions = {}): string {
  const error = validatePolicyTiptapDocument(document);
  if (error) {
    throw new Error(error);
  }
  return tiptapDocumentToHtml(document, options);
}

const POLICY_AUTHORING_CAPABILITIES = {
  ai: false,
  externalVideo: false,
  file: false,
  map: false,
  math: false,
  p5: false,
  shader: false,
  table: true,
  three: false,
} satisfies TiptapAuthoringCapabilities;

export interface PolicyTiptapEditorProps {
  blockRoomController: RichTextBlockRoomTiptapController;
  awareness?: Awareness;
  editable?: boolean;
  structureLocked?: boolean;
  userName?: string;
  userColor?: string;
  onEditorReady?: (editor: PolicyTiptapEditorInstance) => void;
  onUnsupportedContent?: (message: string) => void;
}

export function PolicyTiptapEditor({
  blockRoomController,
  awareness,
  editable = true,
  structureLocked = false,
  userName,
  userColor,
  onEditorReady,
  onUnsupportedContent,
}: PolicyTiptapEditorProps) {
  const onUnsupportedContentRef = useRef(onUnsupportedContent);
  const [unsupportedContent, setUnsupportedContent] = useState<string | null>(null);
  onUnsupportedContentRef.current = onUnsupportedContent;
  const reportUnsupported = useCallback((message: string) => {
    setUnsupportedContent(message);
    onUnsupportedContentRef.current?.(message);
  }, []);
  const authoringMode = useMemo<EditorAuthoringMode>(
    () => ({
      allowNeutralBlockEdits: editable && !structureLocked,
      allowLocalizedBlockEdits: editable,
    }),
    [editable, structureLocked],
  );
  const localUser = useMemo(
    () => ({ name: userName ?? 'Admin', color: userColor ?? DEFAULT_SITE_BRAND_COLOR }),
    [userColor, userName],
  );
  const additionalExtensions = useMemo(() => [createPolicyContentGuard(reportUnsupported)], [reportUnsupported]);
  const handleEditorReady = useCallback(
    (editor: Editor | null) => {
      if (!editor) {
        return;
      }
      const error = validatePolicyTiptapDocument(editor.state.doc);
      if (error) {
        reportUnsupported(error);
        return;
      }
      onEditorReady?.(editor);
    },
    [onEditorReady, reportUnsupported],
  );

  if (unsupportedContent) {
    return (
      <div role="alert" data-testid="policy-tiptap-unsupported-content">
        {unsupportedContent}
      </div>
    );
  }

  if (!awareness) {
    throw new Error('Policy Block-room editor requires provider awareness.');
  }

  return (
    <div data-editor-profile="policy">
      <EditorAuthoringModeProvider value={authoringMode}>
        <TiptapEditor
          blockRoomController={blockRoomController}
          awareness={awareness}
          localUser={localUser}
          editable={editable}
          structureLocked={structureLocked}
          externalVideo={false}
          ai={false}
          authoringCapabilities={POLICY_AUTHORING_CAPABILITIES}
          additionalExtensions={additionalExtensions}
          onEditorReady={handleEditorReady}
        />
      </EditorAuthoringModeProvider>
    </div>
  );
}
