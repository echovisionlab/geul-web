'use client';

import { useMemo, useRef } from 'react';
import { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import { FileButton } from '@mantine/core';
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
}

export function EditorFileInsertPanel({
  multiple,
  onFilesSelected,
  onOpenLibrary,
  showLibraryAction = true,
}: EditorFileInsertPanelProps) {
  const tMedia = useTranslations('editorCommon.media.ingestDialog');
  const resetRef = useRef<() => void>(null);
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
    resetRef.current?.();
  };

  const renderView = (onBrowse: () => void) => (
    <EditorFileInsertView
      labels={labels}
      onBrowse={onBrowse}
      onOpenLibrary={onOpenLibrary}
      showLibraryAction={showLibraryAction}
    />
  );

  return multiple ? (
    <FileButton multiple accept={accept} resetRef={resetRef} onChange={handleFiles}>
      {({ onClick }) => renderView(onClick)}
    </FileButton>
  ) : (
    <FileButton accept={accept} resetRef={resetRef} onChange={(file) => handleFiles(file ? [file] : [])}>
      {({ onClick }) => renderView(onClick)}
    </FileButton>
  );
}
