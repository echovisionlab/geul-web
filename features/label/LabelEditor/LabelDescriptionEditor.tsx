'use client';

import { HocuspocusProvider } from '@hocuspocus/provider';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/core';
import { Box } from '@mantine/core';
import { CompactTiptapEditor } from '@/features/editor/tiptap/profiles/CompactTiptapEditor';
import type { RichTextBlockRoomTiptapController } from '@/features/editor/tiptap/block-room-tiptap-controller';
import classes from './LabelDescriptionEditor.module.css';

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
  userColor = '#3b82f6',
  disabled = false,
  placeholder,
  onChange,
  structureLocked = false,
}: LabelDescriptionEditorProps) {
  const tSlashMenu = useTranslations('editorCommon.editor.slashMenu');
  const awareness = provider.awareness;
  if (!awareness) {
    return null;
  }

  return (
    <Box id={id} className={classes.wrapper} data-disabled={disabled}>
      <CompactTiptapEditor
        blockRoomController={blockRoomController}
        awareness={awareness}
        readOnly={disabled}
        placeholder={placeholder ?? tSlashMenu('placeholder')}
        userName={userName}
        userColor={userColor}
        onChange={onChange}
        structureLocked={structureLocked}
      />
    </Box>
  );
}
