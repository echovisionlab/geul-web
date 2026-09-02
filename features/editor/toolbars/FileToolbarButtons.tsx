'use client';

import { IconMusic, IconPaperclip, IconPhoto, IconTrash, IconVideo } from '@tabler/icons-react';
import {
  deleteCurrentAndNeutralBlock,
  type EditorMediaCommandPort,
  type SelectedFileBlock,
} from '../lib/media-block-updates';

function isMediaBlock(block: SelectedFileBlock | null | undefined): block is SelectedFileBlock {
  return block?.type === 'file';
}

function isMediaBlockBusy(block: SelectedFileBlock): boolean {
  const status = block.props.processingStatus;
  return status === 'uploading' || status === 'processing';
}

function resolveReplaceIcon(mimeType: unknown) {
  const value = typeof mimeType === 'string' ? mimeType : '';
  if (value.startsWith('audio/')) {
    return <IconMusic size={16} />;
  }
  if (value.startsWith('video/')) {
    return <IconVideo size={16} />;
  }
  if (value.startsWith('image/')) {
    return <IconPhoto size={16} />;
  }
  return <IconPaperclip size={16} />;
}

interface DefaultFileToolbarButtonsProps {
  port: EditorMediaCommandPort;
  selectedBlock: SelectedFileBlock | null | undefined;
  onOpenMediaIngest: (blockId: string) => void;
  allowStructuralEdits?: boolean;
}

/** Engine-neutral media actions. Composition owns selected-block observation and dialog state. */
export function DefaultFileToolbarButtons({
  port,
  selectedBlock,
  onOpenMediaIngest,
  allowStructuralEdits = true,
}: DefaultFileToolbarButtonsProps) {
  if (!isMediaBlock(selectedBlock)) {
    return null;
  }

  const replaceTooltip = 'Replace file';
  const removeTooltip = 'Remove';
  const canReplace = allowStructuralEdits && !isMediaBlockBusy(selectedBlock);

  return (
    <>
      {canReplace ? (
        <button
          type="button"
          className="bn-button"
          data-test="replaceFileButton"
          aria-label={replaceTooltip}
          title={replaceTooltip}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onOpenMediaIngest(selectedBlock.id)}
        >
          {resolveReplaceIcon(selectedBlock.props.mimeType)}
        </button>
      ) : null}
      {allowStructuralEdits ? (
        <button
          type="button"
          className="bn-button"
          data-test="deleteFileButton"
          aria-label={removeTooltip}
          title={removeTooltip}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => deleteCurrentAndNeutralBlock(port, selectedBlock)}
        >
          <IconTrash size={16} />
        </button>
      ) : null}
    </>
  );
}
