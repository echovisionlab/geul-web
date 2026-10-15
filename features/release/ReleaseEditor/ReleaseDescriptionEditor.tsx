'use client';

import { primitiveTokens } from '@/components/core/design-tokens';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/core';

import { CompactTiptapEditor } from '@/features/editor/tiptap/profiles/CompactTiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';

interface ReleaseDescriptionEditorProps {
  releaseId: string;
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

export function ReleaseDescriptionEditor({
  id,
  provider,
  blockRoomController,
  userName = 'Anonymous',
  userColor = primitiveTokens.colors.annotation,
  disabled = false,
  placeholder,
  onChange,
  structureLocked = false,
}: ReleaseDescriptionEditorProps) {
  const tSlashMenu = useTranslations('editorCommon.editor.slashMenu');
  const commonLabels = useTranslations('common.labels');
  const awareness = provider.awareness;
  if (!awareness) {
    return null;
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
