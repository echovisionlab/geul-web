'use client';

import {
  EmailTiptapEditor,
  type EmailCampaignTiptapEditorHandle,
} from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import type { CollaborationAwarenessProvider } from '@/lib/collab/createCollaborationConfig';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';

interface CampaignEditorProps {
  campaignId: string;
  provider: CollaborationAwarenessProvider;
  blockRoomController: RichTextBlockRoomTiptapController;
  userName?: string;
  userColor?: string;
  editable?: boolean;
  structureLocked?: boolean;
  onEditorReady?: (editor: EmailCampaignTiptapEditorHandle) => void;
  onContentChange?: (editor: EmailCampaignTiptapEditorHandle) => void;
}

export function CampaignEditor({
  provider,
  blockRoomController,
  userName = 'Anonymous',
  userColor = '#3b82f6',
  editable = true,
  structureLocked = false,
  onEditorReady,
  onContentChange,
}: CampaignEditorProps) {
  const awareness = provider.awareness;
  if (!awareness) {
    return null;
  }
  return (
    <EmailTiptapEditor
      blockRoomController={blockRoomController}
      awareness={awareness}
      userName={userName}
      userColor={userColor}
      editable={editable}
      structureLocked={structureLocked}
      onEditorReady={onEditorReady}
      onContentChange={onContentChange}
    />
  );
}
