'use client';

import { useMemo } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { FilePicker } from '@/components/core/Input';
import { useTranslations } from 'next-intl';
import { getUploadSelectionMimeTypes } from '@/lib/constants/upload-config';
import { EditorFileInsertView, type EditorFileInsertViewLabels } from './EditorFileInsertView';

const unifiedEditorUploadTypes = [
  UploadType.EDITOR_IMAGE,
  UploadType.EDITOR_AUDIO,
  UploadType.EDITOR_VIDEO,
  UploadType.EDITOR_ATTACHMENT,
] as const;

interface EditorFileInsertPanelProps {
  multiple: boolean;
  onFilesSelected: (files: File[]) => void;
  onOpenLibrary: () => void;
  showLibraryAction?: boolean;
  /** Hide redundant guidance when the enclosing dialog already names the upload/library choices. */
  showDescription?: boolean;
}

export function EditorFileInsertPanel({
  multiple,
  onFilesSelected,
  onOpenLibrary,
  showLibraryAction = true,
  showDescription = true,
}: EditorFileInsertPanelProps) {
  const tMedia = useTranslations('editorCommon.media.ingestDialog');
  const accept = useMemo(
    () =>
      Array.from(
        new Set(unifiedEditorUploadTypes.flatMap((uploadType) => [...getUploadSelectionMimeTypes(uploadType)])),
      ).join(','),
    [],
  );
  const labels: EditorFileInsertViewLabels = {
    description: tMedia('unifiedDescription'),
    browse: tMedia('browse'),
    openLibrary: tMedia('openLibrary'),
  };

  const handleFiles = (files: File[]) => {
    if (files.length > 0) {
      onFilesSelected(files);
    }
  };

  const renderView = (onBrowse: () => void) => (
    <EditorFileInsertView
      labels={labels}
      onBrowse={onBrowse}
      onOpenLibrary={onOpenLibrary}
      showLibraryAction={showLibraryAction}
      showDescription={showDescription}
    />
  );

  return (
    <FilePicker multiple={multiple} accept={accept} onChange={handleFiles}>
      {renderView}
    </FilePicker>
  );
}
