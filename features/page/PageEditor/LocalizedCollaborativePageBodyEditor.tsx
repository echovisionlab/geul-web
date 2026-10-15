'use client';

import { useCallback } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import type { PageSectionLocalePropKey } from '@/features/translation/PageSectionLocalePropFields';
import { usePageEditor } from './PageEditorContext';
import { usePageSectionBlockRoomController } from './usePageSectionBlockRoomController';
import { LocalizedPageBodyView } from './LocalizedPageBodyView';

function CollaborativeRichText({ sectionId, editable }: { sectionId: string; editable: boolean }) {
  const { doc, provider, locale, userName, pageId } = usePageEditor();
  const blockRoomController = usePageSectionBlockRoomController(doc, locale, sectionId);
  return (
    <LocalizedRichTextFragmentEditor
      provider={provider}
      blockRoomController={blockRoomController}
      userName={userName}
      editable={editable}
      entityId={pageId}
      entityType={TranscodeEntityType.PAGE}
      allowNeutralBlockEdits={false}
      allowStructuralEdits={false}
      aiTarget={editable ? { type: 'page', id: pageId, locale } : undefined}
    />
  );
}

export function LocalizedCollaborativePageBodyEditor({
  fallbackText,
  editable = true,
}: {
  fallbackText: string;
  editable?: boolean;
}) {
  const { sections, locale, updateLocalizedSectionProps } = usePageEditor();
  const onPropChange = useCallback(
    (sectionId: string, key: PageSectionLocalePropKey, value: string) => {
      updateLocalizedSectionProps(sectionId, { [key]: value });
    },
    [updateLocalizedSectionProps],
  );
  return (
    <LocalizedPageBodyView
      sections={sections}
      locale={locale}
      editable={editable}
      fallbackText={fallbackText}
      onPropChange={onPropChange}
      renderRichText={(section) => <CollaborativeRichText sectionId={section.id} editable={editable} />}
    />
  );
}
