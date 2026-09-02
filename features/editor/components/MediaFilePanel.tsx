'use client';

import { useOptionalEditorMediaIngestContext } from '@/features/editor/contexts/EditorMediaIngestContext';
import { type EditorMediaCommandPort, type EditorMediaBlockType } from '../lib/media-block-updates';
import { MediaIngestDialog, type MediaIngestDialogCloseReason } from './MediaIngestDialog';

export interface MediaFilePanelProps {
  blockId: string;
  editor: EditorMediaCommandPort;
  opened?: boolean;
  onClose: (reason: MediaIngestDialogCloseReason) => void;
}

function isSupportedBlockType(value: string | undefined): value is EditorMediaBlockType {
  return value === 'file';
}

export function MediaFilePanel({ blockId, editor, opened = true, onClose }: MediaFilePanelProps) {
  const mediaIngest = useOptionalEditorMediaIngestContext();
  const selectedBlock = editor.getBlock(blockId);
  const blockType = isSupportedBlockType(selectedBlock?.type) ? selectedBlock.type : null;

  if (!selectedBlock || !blockType || !mediaIngest) {
    return null;
  }
  return (
    <MediaIngestDialog
      opened={opened}
      editor={editor}
      selectedBlock={selectedBlock}
      blockType={blockType}
      onClose={onClose}
      onUploadFiles={(files) => {
        void mediaIngest.dropFilesAtBlock(selectedBlock.id, files);
      }}
      onSelectLibraryFiles={(files) => {
        mediaIngest.selectLibraryFilesAtBlock(selectedBlock.id, files);
      }}
    />
  );
}
