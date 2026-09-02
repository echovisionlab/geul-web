import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { SegmentType } from '@echovisionlab/geul-proto/secure/audience_pb.ts';

export function isFileDownloadPolicyEntityType(entityType: TranscodeEntityType): boolean {
  return (
    entityType === TranscodeEntityType.POST ||
    entityType === TranscodeEntityType.PAGE ||
    entityType === TranscodeEntityType.WORK ||
    entityType === TranscodeEntityType.PROGRAM_EVENT ||
    entityType === TranscodeEntityType.TRACK
  );
}

export function isEditorFileDownloadPolicyEntityType(entityType: TranscodeEntityType): boolean {
  return (
    entityType === TranscodeEntityType.POST ||
    entityType === TranscodeEntityType.PAGE ||
    entityType === TranscodeEntityType.WORK ||
    entityType === TranscodeEntityType.PROGRAM_EVENT
  );
}

export type FileDownloadAudience = 'disabled' | 'public' | 'authenticated' | 'restricted';

export interface AudienceSegmentSummary {
  id: string;
  name: string;
  description: string;
  segmentType: SegmentType;
}

export interface FileDownloadPolicyModel {
  entityType?: TranscodeEntityType;
  entityId?: string;
  blockId?: string;
  referencePath?: string;
  fileId: string;
  audience: FileDownloadAudience;
  audienceSegments: AudienceSegmentSummary[];
}

export interface FileDownloadPolicyTarget {
  entityType: TranscodeEntityType;
  entityId: string;
  blockId?: string;
  referencePath?: string;
  /** Compare-and-set guard only; the server resolves the current relation. */
  expectedFileId: string;
}

export interface FileDownloadPageInput {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface FileDownloadPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export type FileDownloadActionErrorCode =
  'invalidTarget' | 'missingResponse' | 'loadFailed' | 'saveFailed' | 'staleTarget';

export interface FileDownloadActionResult<T> {
  data?: T;
  errorCode?: FileDownloadActionErrorCode;
}
