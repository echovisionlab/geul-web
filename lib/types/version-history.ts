import type { DocumentLayout } from '@echovisionlab/geul-common/collaboration/document-layout';

export type VersionedEntityType = 'post' | 'page' | 'work';

export interface VersionContributor {
  memberId: string;
  nickname: string;
}

export interface VersionInfo {
  id: string;
  version: number;
  title: string;
  sourceLocale: string;
  contributors: VersionContributor[];
  createdAt: string;
  documentLayout?: DocumentLayout;
}

export interface VersionListResult {
  versions?: VersionInfo[];
  total?: number;
  error?: string;
}

export interface VersionMutationResult {
  success?: boolean;
  error?: string;
}
