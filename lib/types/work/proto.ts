import {
  WorkStatus as PublicWorkStatus,
  WorkType as PublicWorkType,
} from '@echovisionlab/geul-proto/public/work_pb.ts';
import { WorkStatus, WorkType } from '@echovisionlab/geul-proto/secure/work_pb.ts';
import type { WorkStatus as WorkStatusValue, WorkType as WorkTypeValue } from '@/lib/types/work/model';

export function stringToWorkType(type?: string): WorkType {
  switch (type) {
    case 'music_project':
      return WorkType.MUSIC_PROJECT;
    case 'portfolio':
      return WorkType.PORTFOLIO;
    case 'article':
      return WorkType.ARTICLE;
    case 'contribution':
      return WorkType.CONTRIBUTION;
    default:
      return WorkType.UNSPECIFIED;
  }
}

export function workTypeToString(type: WorkType): WorkTypeValue {
  switch (type) {
    case WorkType.PORTFOLIO:
      return 'portfolio';
    case WorkType.ARTICLE:
      return 'article';
    case WorkType.CONTRIBUTION:
      return 'contribution';
    default:
      return 'music_project';
  }
}

export function stringToWorkStatus(status?: string): WorkStatus {
  switch (status) {
    case 'draft':
      return WorkStatus.DRAFT;
    case 'published':
      return WorkStatus.PUBLISHED;
    case 'archived':
      return WorkStatus.ARCHIVED;
    default:
      return WorkStatus.UNSPECIFIED;
  }
}

export function workStatusToString(status: WorkStatus): WorkStatusValue {
  switch (status) {
    case WorkStatus.PUBLISHED:
      return 'published';
    case WorkStatus.ARCHIVED:
      return 'archived';
    default:
      return 'draft';
  }
}

export function publicWorkTypeToString(type: PublicWorkType): WorkTypeValue {
  switch (type) {
    case PublicWorkType.PORTFOLIO:
      return 'portfolio';
    case PublicWorkType.ARTICLE:
      return 'article';
    case PublicWorkType.CONTRIBUTION:
      return 'contribution';
    default:
      return 'music_project';
  }
}

export function publicWorkStatusToString(status: PublicWorkStatus): WorkStatusValue {
  switch (status) {
    case PublicWorkStatus.PUBLISHED:
      return 'published';
    case PublicWorkStatus.ARCHIVED:
      return 'archived';
    default:
      return 'draft';
  }
}
