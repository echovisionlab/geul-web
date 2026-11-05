'use client';

import { PageLoader } from '@/features/site/PageLoader';
import type { ReactNode } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { HocuspocusProvider } from '@hocuspocus/provider';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import { LocalizedCollaborativeRichTextEditor } from './LocalizedCollaborativeRichTextEditor';

interface LocalizedRichTextFragmentEditorSharedProps {
  accessibleLabel?: string;
  contentLanguage?: string;
  provider: HocuspocusProvider | null;
  blockRoomController: RichTextBlockRoomTiptapController | null;
  userName: string;
  editable: boolean;
  entityId: string;
  entityType: TranscodeEntityType;
  allowNeutralBlockEdits?: boolean;
  allowStructuralEdits?: boolean;
  fallback?: ReactNode;
}

type LocalizedRichTextFragmentEditorProps = LocalizedRichTextFragmentEditorSharedProps;

export function LocalizedRichTextFragmentEditor({
  accessibleLabel,
  contentLanguage,
  provider,
  blockRoomController,
  userName,
  editable,
  entityId,
  entityType,
  allowNeutralBlockEdits = false,
  allowStructuralEdits = false,
  fallback = <PageLoader placement="flow" />,
}: LocalizedRichTextFragmentEditorProps) {
  if (!provider || !blockRoomController) {
    return <>{fallback}</>;
  }

  return (
    <LocalizedCollaborativeRichTextEditor
      accessibleLabel={accessibleLabel}
      contentLanguage={contentLanguage}
      provider={provider}
      blockRoomController={blockRoomController}
      userName={userName}
      editable={editable}
      allowNeutralBlockEdits={allowNeutralBlockEdits}
      allowStructuralEdits={allowStructuralEdits}
      entityId={entityId}
      entityType={entityType}
    />
  );
}
