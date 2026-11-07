'use client';

import { PageLoader } from '@/features/site/PageLoader/PageLoader';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/core';

import { CompactTiptapEditor } from '@/features/editor/tiptap/profiles/CompactTiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';

interface LabelDescriptionEditorProps {
  labelId: string;
  id?: string;
  provider: HocuspocusProvider;
  blockRoomController: RichTextBlockRoomTiptapController;
  userName?: string;
  userColor?: string;
  disabled?: boolean;
  placeholder?: string;
  onChange?: (editor: Editor) => void;
  structureLocked?: boolean;
}

export function LabelDescriptionEditor({
  id,
  provider,
  blockRoomController,
  userName = 'Anonymous',
  userColor = primitiveTokens.colors.annotation,
  disabled = false,
  placeholder,
  onChange,
  structureLocked = false,
}: LabelDescriptionEditorProps) {
  const tSlashMenu = useTranslations('editorCommon.editor.slashMenu');
  const commonLabels = useTranslations('common.labels');
  const awareness = provider.awareness;
  if (!awareness) {
    return <PageLoader placement="flow" />;
  }

  return (
    <CompactTiptapEditor
      accessibleLabel={commonLabels('description')}
      id={id}
      blockRoomController={blockRoomController}
      awareness={awareness}
      readOnly={disabled}
      placeholder={placeholder ?? tSlashMenu('placeholder')}
      userName={userName}
      userColor={userColor}
      onChange={onChange}
      structureLocked={structureLocked}
    />
  );
}
