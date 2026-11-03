import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { MemberCriteriaKind } from '@echovisionlab/geul-proto/secure/member_criteria_pb.ts';

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

export type FileDownloadAccess = 'disabled' | 'public' | 'authenticated' | 'restricted';

export interface MemberCriteriaSummary {
  id: string;
  name: string;
  description: string;
  kind: MemberCriteriaKind;
}

export interface FileDownloadPolicyModel {
  entityType?: TranscodeEntityType;
  entityId?: string;
  blockId?: string;
  referencePath?: string;
  fileId: string;
  access: FileDownloadAccess;
  memberCriteria: MemberCriteriaSummary[];
}

export interface FileDownloadPolicyObservedState {
  access: FileDownloadAccess;
  memberCriteriaIds: string[];
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
  'invalidTarget' | 'invalidPolicyBaseline' | 'missingResponse' | 'loadFailed' | 'saveFailed' | 'staleTarget';

export interface FileDownloadActionResult<T> {
  data?: T;
  errorCode?: FileDownloadActionErrorCode;
}
