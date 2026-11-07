'use client';

import { useTranslations } from 'next-intl';
import { Alert } from '@/components/core/Alert';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import {
  EmailTiptapEditor,
  type EmailCampaignTiptapEditorHandle,
} from '@/features/editor/tiptap/profiles/EmailTiptapEditor';
import type { CollaborationAwarenessProvider } from '@/lib/collab/collaboration-awareness-provider';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';

interface CampaignEditorProps {
  campaignId: string;
  provider: CollaborationAwarenessProvider;
  blockRoomController: RichTextBlockRoomTiptapController;
  accessibleLabel?: string;
  contentLanguage?: string;
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
  accessibleLabel,
  contentLanguage,
  userName = 'Anonymous',
  userColor = primitiveTokens.colors.annotation,
  editable = true,
  structureLocked = false,
  onEditorReady,
  onContentChange,
}: CampaignEditorProps) {
  const tStates = useTranslations('common.states');
  const awareness = provider.awareness;
  if (!awareness) {
    return <Alert tone="danger">{tStates('notAvailable')}</Alert>;
  }
  return (
    <EmailTiptapEditor
      accessibleLabel={accessibleLabel}
      contentLanguage={contentLanguage}
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
