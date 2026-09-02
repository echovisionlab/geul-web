'use client';

import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import {
  PolicyTiptapEditor,
  type PolicyTiptapEditorInstance,
} from '@/features/editor/tiptap/profiles/PolicyTiptapEditor';

export type PolicyEditorInstance = PolicyTiptapEditorInstance;

interface PolicyEditorProps {
  provider: HocuspocusProvider;
  blockRoomController: RichTextBlockRoomTiptapController;
  userName?: string;
  userColor?: string;
  readOnly?: boolean;
  structureLocked?: boolean;
  onEditorReady?: (editor: PolicyEditorInstance) => void;
  onUnsupportedContent?: (message: string) => void;
}

export function PolicyEditor({
  provider,
  blockRoomController,
  userName = 'Admin',
  userColor = '#b02d23',
  readOnly = false,
  structureLocked = false,
  onEditorReady,
  onUnsupportedContent,
}: PolicyEditorProps) {
  return (
    <PolicyTiptapEditor
      blockRoomController={blockRoomController}
      awareness={provider.awareness ?? undefined}
      editable={!readOnly}
      structureLocked={structureLocked}
      userName={userName}
      userColor={userColor}
      onEditorReady={onEditorReady}
      onUnsupportedContent={onUnsupportedContent}
    />
  );
}
