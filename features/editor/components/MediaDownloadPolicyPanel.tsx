'use client';

import type { EditorMediaBlockType } from '@/features/editor/lib/media-block-updates';
import {
  FileDownloadPolicyEditor,
  type FileDownloadPolicyEditorAdapter,
} from '@/features/media-download/FileDownloadPolicyEditor';
import { isEditorFileDownloadPolicyEntityType, type FileDownloadPolicyTarget } from '@/lib/types/file-download-access';

export type MediaDownloadPolicyRuntimeTarget = Pick<FileDownloadPolicyTarget, 'entityType' | 'entityId'>;

interface MediaDownloadPolicyPanelProps {
  fileId: string | null | undefined;
  blockId: string | null | undefined;
  blockType: EditorMediaBlockType | null | undefined;
  runtimeTarget: MediaDownloadPolicyRuntimeTarget | null | undefined;
  adapter: FileDownloadPolicyEditorAdapter;
}

export function MediaDownloadPolicyPanel({
  fileId,
  blockId,
  blockType,
  runtimeTarget,
  adapter,
}: MediaDownloadPolicyPanelProps) {
  if (!blockType) {
    return null;
  }

  const normalizedFileId = String(fileId || '').trim();
  const normalizedBlockId = String(blockId || '').trim();
  if (
    !normalizedFileId ||
    !normalizedBlockId ||
    !runtimeTarget?.entityId.trim() ||
    !isEditorFileDownloadPolicyEntityType(runtimeTarget.entityType)
  ) {
    return null;
  }

  return (
    <FileDownloadPolicyEditor
      entityType={runtimeTarget.entityType}
      entityId={runtimeTarget.entityId.trim()}
      blockId={normalizedBlockId}
      referencePath="file"
      expectedFileId={normalizedFileId}
      adapter={adapter}
      presentation="media-header"
    />
  );
}
