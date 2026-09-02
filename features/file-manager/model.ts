import type { MediaProcessingStatus } from '@echovisionlab/geul-proto/common/media_pb.ts';
import type { FileDerivativeType, FileUsageDomain } from '@echovisionlab/geul-proto/secure/file_pb.ts';

export interface FileManagerMemberView {
  id: string;
  nickname: string;
  deleted: boolean;
}

export interface FileManagerPathSegmentView {
  id: string;
  name: string;
}

export interface FileManagerFolderView {
  kind: 'folder';
  id: string;
  parentId?: string;
  name: string;
  createdByMember?: FileManagerMemberView;
  createdAt: string | null;
  updatedAt: string | null;
  folderPath?: FileManagerPathSegmentView[];
}

export interface FileManagerFileView {
  kind: 'file';
  id: string;
  folderId?: string;
  fileName: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  durationSeconds?: number;
  uploadedByMember?: FileManagerMemberView;
  createdAt: string | null;
  updatedAt: string | null;
  usageCount: number;
  inlineUrl?: string;
  downloadUrl?: string;
  playbackUrl?: string;
  thumbnailUrl?: string;
  waveformUrl?: string;
  processingStatus?: MediaProcessingStatus;
  generatedOutputs?: FileManagerGeneratedOutputView[];
  folderPath?: FileManagerPathSegmentView[];
}

export interface FileManagerGeneratedOutputView {
  id: string;
  type: FileDerivativeType;
  status: MediaProcessingStatus;
  url?: string;
}

export type FileManagerItemView = FileManagerFolderView | FileManagerFileView;

export interface FileManagerUsageItemView {
  domain: FileUsageDomain;
  entityId: string;
  slot: string;
  blockId?: string;
  blockType?: string;
  title?: string;
  link?: string;
  count: number;
}
