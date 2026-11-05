'use client';

import { DEFAULT_SITE_BRAND_COLOR } from '@/lib/theme/site-brand';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Extension, type Editor } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import type { Awareness } from 'y-protocols/awareness';
import type { RichTextBlockRoomTiptapController } from '../block-room-tiptap-controller';
import { EditorAuthoringModeProvider, type EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { validatePolicyTiptapDocument } from './policy-document';
import { TiptapEditor } from '@/features/editor/tiptap/TiptapEditor';
import type { TiptapAuthoringCapabilities } from '@/features/editor/tiptap/TiptapAuthoringControls';

export type PolicyTiptapEditorInstance = Editor;

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

const POLICY_AUTHORING_CAPABILITIES = {
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
  onEditorReady?: (editor: PolicyTiptapEditorInstance | null) => void;
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
  const [unsupportedContent, setUnsupportedContent] = useState<{
    controller: RichTextBlockRoomTiptapController;
    message: string;
  } | null>(null);
  onUnsupportedContentRef.current = onUnsupportedContent;
  const reportUnsupported = useCallback(
    (message: string) => {
      setUnsupportedContent({ controller: blockRoomController, message });
      onUnsupportedContentRef.current?.(message);
    },
    [blockRoomController],
  );
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
        onEditorReady?.(null);
        return;
      }
      const error = validatePolicyTiptapDocument(editor.state.doc);
      if (error) {
        onEditorReady?.(null);
        reportUnsupported(error);
        return;
      }
      onEditorReady?.(editor);
    },
    [onEditorReady, reportUnsupported],
  );

  if (unsupportedContent?.controller === blockRoomController) {
    return (
      <div role="alert" data-testid="policy-tiptap-unsupported-content">
        {unsupportedContent.message}
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
          authoringCapabilities={POLICY_AUTHORING_CAPABILITIES}
          additionalExtensions={additionalExtensions}
          onEditorReady={handleEditorReady}
        />
      </EditorAuthoringModeProvider>
    </div>
  );
}
