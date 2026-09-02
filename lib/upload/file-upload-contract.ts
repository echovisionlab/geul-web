import type { FileIngestRuntimeSource } from '@echovisionlab/geul-common/collaboration/runtime-events';
import type { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import type { UploadType } from '@echovisionlab/geul-proto/secure/file_pb.ts';
import type { UploadAttemptProgress } from './upload-progress';
import type { UploadLifecycleStage } from '@/lib/utils/upload-runtime';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  stage?: UploadLifecycleStage;
}

export interface FileIngestLifecycleUpdate {
  correlationId: string;
  mode: FileIngestRuntimeSource;
  stage: UploadLifecycleStage;
  percentage?: number;
  loadedBytes?: number;
  totalBytes?: number;
  fileId?: string;
  error?: string;
  source: 'local' | 'server';
}

export interface UploadOptions {
  uploadType: UploadType;
  entityId?: string;
  entityType?: TranscodeEntityType;
  slotId?: string;
  resumeSession?: {
    fileId: string;
    uploadId: string;
  };
  expectedCurrentFileId?: string;
  onProgress?: (progress: UploadProgress) => void;
  onLifecycle?: (update: FileIngestLifecycleUpdate) => void;
  onMultipartSession?: (session: {
    uploadId: string;
    fileId: string;
    slotId?: string;
    attemptId?: string;
    resumed: boolean;
    resumable: boolean;
  }) => void;
  correlationId?: string;
  concurrency?: number;
}

export interface DownloadFromUrlOptions {
  correlationId?: string;
  slotId?: string;
  surfaceSlotId?: string;
  attemptId?: string;
  expectedCurrentFileId?: string;
  onLifecycle?: (update: FileIngestLifecycleUpdate) => void;
}

export interface UploadResult {
  url: string;
  fileId: string;
  slotId?: string;
  attemptId?: string;
}

export interface InFlightServerLifecycle {
  onLifecycle?: (update: FileIngestLifecycleUpdate) => void;
  uploadSurfaceKey?: string;
  activityId: string;
  progress: UploadAttemptProgress;
}
