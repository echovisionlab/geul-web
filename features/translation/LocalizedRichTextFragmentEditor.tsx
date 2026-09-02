'use client';

import type { ReactNode } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { LocalizedCollaborativeRichTextEditor } from './LocalizedCollaborativeRichTextEditor';

interface LocalizedRichTextFragmentEditorSharedProps {
  provider: HocuspocusProvider | null;
  blockRoomController: RichTextBlockRoomTiptapController | null;
  userName: string;
  editable: boolean;
  entityId: string;
  entityType: TranscodeEntityType;
  allowNeutralBlockEdits?: boolean;
  allowStructuralEdits?: boolean;
  aiTarget?: AIDocumentTarget;
  fallback?: ReactNode;
}

type LocalizedRichTextFragmentEditorProps = LocalizedRichTextFragmentEditorSharedProps;

export function LocalizedRichTextFragmentEditor({
  provider,
  blockRoomController,
  userName,
  editable,
  entityId,
  entityType,
  allowNeutralBlockEdits = false,
  allowStructuralEdits = false,
  aiTarget,
  fallback = null,
}: LocalizedRichTextFragmentEditorProps) {
  if (!provider || !blockRoomController) {
    return <>{fallback}</>;
  }

  return (
    <LocalizedCollaborativeRichTextEditor
      provider={provider}
      blockRoomController={blockRoomController}
      userName={userName}
      editable={editable}
      allowNeutralBlockEdits={allowNeutralBlockEdits}
      allowStructuralEdits={allowStructuralEdits}
      aiTarget={aiTarget}
      entityId={entityId}
      entityType={entityType}
    />
  );
}
