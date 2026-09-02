'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Stack } from '@mantine/core';
import { ContentModal } from '@/components/core/Modal';
import { Tabs } from '@/components/core/Tabs';
import { EditorFileLibraryPicker } from '@/features/editor/components/EditorFileLibraryPicker';
import { EditorFileInsertPanel } from '@/features/editor/components/EditorFileInsertPanel';
import { applyEditorLibraryFileSelection } from '@/features/editor/lib/editor-library-file-selection';
import { getEditorMediaIngestDialogId } from '@/features/editor/lib/media-test-ids';
import { EditorMediaCommandPort, EditorMediaBlockType, SelectedFileBlock } from '../lib/media-block-updates';

export type MediaIngestDialogCloseReason = 'cancelled' | 'committed';

interface MediaIngestDialogProps {
  opened: boolean;
  editor: EditorMediaCommandPort;
  selectedBlock: SelectedFileBlock;
  blockType: EditorMediaBlockType;
  onClose: (reason: MediaIngestDialogCloseReason) => void;
  mode?: 'add' | 'replace' | 'auto';
  onUploadFiles?: (files: File[]) => void;
  onSelectLibraryFiles?: (files: Parameters<typeof applyEditorLibraryFileSelection>[3][]) => void;
}

function getItemLabel(blockType: EditorMediaBlockType, tCommonLabels: ReturnType<typeof useTranslations>) {
  return tCommonLabels(blockType);
}

export function MediaIngestDialog({
  opened,
  editor,
  selectedBlock,
  blockType,
  onClose,
  mode = 'auto',
  onUploadFiles,
  onSelectLibraryFiles,
}: MediaIngestDialogProps) {
  const tMedia = useTranslations('editorCommon.media');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const [libraryOpened, setLibraryOpened] = useState(false);

  useEffect(() => {
    if (!opened) {
      setLibraryOpened(false);
    }
  }, [opened]);

  const itemLabel = getItemLabel(blockType, tCommonLabels);
  const resolvedMode = mode === 'auto' ? 'replace' : mode;
  const title =
    resolvedMode === 'add'
      ? tMedia('ingestDialog.addItem', { item: itemLabel })
      : tMedia('ingestDialog.replaceItem', { item: itemLabel });
  const libraryPicker = (
    <EditorFileLibraryPicker
      allowMultiple={resolvedMode === 'add'}
      onSelect={(files) => {
        onClose('committed');
        if (onSelectLibraryFiles) {
          onSelectLibraryFiles(files);
        } else if (files[0]) {
          applyEditorLibraryFileSelection(editor, selectedBlock, blockType, files[0]);
        }
      }}
    />
  );
  if (!onUploadFiles) {
    throw new Error(`Tiptap media ingest is unavailable for ${blockType}: no upload command was provided.`);
  }
  const uploadPanel = (
    <EditorFileInsertPanel
      multiple={resolvedMode === 'add'}
      showLibraryAction
      onFilesSelected={(files) => {
        onClose('committed');
        onUploadFiles(files);
      }}
      onOpenLibrary={() => setLibraryOpened(true)}
    />
  );
  return (
    <ContentModal
      id={getEditorMediaIngestDialogId(blockType, selectedBlock.id)}
      opened={opened}
      onClose={() => onClose('cancelled')}
      title={title}
      centered
      size="workspace"
      closeLabel={tCommonActions('close')}
    >
      <Tabs
        value={libraryOpened ? 'library' : 'upload'}
        onChange={(value) => setLibraryOpened(value === 'library')}
        style={{ display: 'flex', flex: '1 1 auto', flexDirection: 'column', minHeight: 0 }}
      >
        <Tabs.List>
          <Tabs.Tab value="upload">{tMedia('ingestDialog.backToUpload')}</Tabs.Tab>
          <Tabs.Tab value="library">{tMedia('ingestDialog.openLibrary')}</Tabs.Tab>
        </Tabs.List>
        <Stack gap="md" style={{ flex: '1 1 auto', minHeight: 0, paddingTop: 'var(--mantine-spacing-md)' }}>
          {libraryOpened ? libraryPicker : uploadPanel}
        </Stack>
      </Tabs>
    </ContentModal>
  );
}
