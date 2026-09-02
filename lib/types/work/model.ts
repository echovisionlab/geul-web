export type WorkType = 'music_project' | 'portfolio' | 'article' | 'contribution';
export type WorkStatus = 'draft' | 'published' | 'archived';
export {
  myCreditedWorkFilterFields,
  myCreditedWorkSortFields,
  myWorkFilterFields,
  myWorkSortFields,
  workFilterFields,
  workSortFields,
} from './table-spec';

export const WORK_TYPES: WorkType[] = ['music_project', 'portfolio', 'article', 'contribution'];

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  music_project: 'Music Project',
  portfolio: 'Portfolio',
  article: 'Article',
  contribution: 'Contribution',
};

export const WORK_TYPE_FILTER_VALUES: Record<WorkType, string> = {
  music_project: 'WORK_TYPE_MUSIC_PROJECT',
  portfolio: 'WORK_TYPE_PORTFOLIO',
  article: 'WORK_TYPE_ARTICLE',
  contribution: 'WORK_TYPE_CONTRIBUTION',
};

export type CreditType = 'artist' | 'member' | 'name';

export interface CreditedWork {
  id: string;
  title: string;
  slug: string | null;
  type: WorkType;
  status: WorkStatus;
  creditId: string;
  creditRole: string | null;
  creditType: CreditType;
  creditedAs: string;
  creditedAsImage: string | null;
}
