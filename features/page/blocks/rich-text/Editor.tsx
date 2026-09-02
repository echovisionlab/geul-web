'use client';

import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { usePageSectionBlockRoomController } from '@/features/page/PageEditor/usePageSectionBlockRoomController';
import type { BlockEditorProps } from '../types';
import type { RichTextProps } from './schema';

export function RichTextEditor({ sectionId }: BlockEditorProps<RichTextProps>) {
  const { doc, provider, locale, userName, pageId, editable, allowStructuralEdits } = usePageEditor();
  const blockRoomController = usePageSectionBlockRoomController(doc, locale, sectionId);
  return (
    <LocalizedRichTextFragmentEditor
      provider={provider}
      blockRoomController={blockRoomController}
      userName={userName}
      editable={editable}
      entityId={pageId}
      entityType={TranscodeEntityType.PAGE}
      allowNeutralBlockEdits={allowStructuralEdits}
      allowStructuralEdits={allowStructuralEdits}
      aiTarget={editable ? { type: 'page', id: pageId, locale } : undefined}
    />
  );
}
