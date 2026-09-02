import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';

export type TranslationEntityTypeKey =
  | 'page'
  | 'post'
  | 'post_series'
  | 'work'
  | 'program_event'
  | 'artist'
  | 'label'
  | 'release'
  | 'menu'
  | 'email_template'
  | 'email_layout'
  | 'campaign'
  | 'form'
  | 'privacy'
  | 'terms';

export interface TranslationLifecycleRefetchHint {
  jobId: string;
  entityType: TranslationEntityTypeKey;
  entityId: string;
  targetLocale: string;
  timestampMs: number;
}

export function translationJobEntityTypeFilterValue(entityType: TranslationEntityTypeKey): string {
  return entityType === 'post_series' ? 'series' : entityType;
}

export function translationEntityTypeToKey(entityType: TranslationEntityType): TranslationEntityTypeKey | null {
  switch (entityType) {
    case TranslationEntityType.PAGE:
      return 'page';
    case TranslationEntityType.POST:
      return 'post';
    case TranslationEntityType.POST_SERIES:
      return 'post_series';
    case TranslationEntityType.WORK:
      return 'work';
    case TranslationEntityType.PROGRAM_EVENT:
      return 'program_event';
    case TranslationEntityType.ARTIST:
      return 'artist';
    case TranslationEntityType.LABEL:
      return 'label';
    case TranslationEntityType.RELEASE:
      return 'release';
    case TranslationEntityType.MENU:
      return 'menu';
    case TranslationEntityType.EMAIL_TEMPLATE:
      return 'email_template';
    case TranslationEntityType.EMAIL_LAYOUT:
      return 'email_layout';
    case TranslationEntityType.PRIVACY:
      return 'privacy';
    case TranslationEntityType.TERMS:
      return 'terms';
    case TranslationEntityType.CAMPAIGN:
      return 'campaign';
    case TranslationEntityType.FORM:
      return 'form';
    default:
      return null;
  }
}

export function translationEntityTypeFromKey(entityType: TranslationEntityTypeKey): TranslationEntityType {
  switch (entityType) {
    case 'page':
      return TranslationEntityType.PAGE;
    case 'post':
      return TranslationEntityType.POST;
    case 'post_series':
      return TranslationEntityType.POST_SERIES;
    case 'work':
      return TranslationEntityType.WORK;
    case 'program_event':
      return TranslationEntityType.PROGRAM_EVENT;
    case 'artist':
      return TranslationEntityType.ARTIST;
    case 'label':
      return TranslationEntityType.LABEL;
    case 'release':
      return TranslationEntityType.RELEASE;
    case 'menu':
      return TranslationEntityType.MENU;
    case 'email_template':
      return TranslationEntityType.EMAIL_TEMPLATE;
    case 'email_layout':
      return TranslationEntityType.EMAIL_LAYOUT;
    case 'privacy':
      return TranslationEntityType.PRIVACY;
    case 'terms':
      return TranslationEntityType.TERMS;
    case 'campaign':
      return TranslationEntityType.CAMPAIGN;
    case 'form':
      return TranslationEntityType.FORM;
  }
}
