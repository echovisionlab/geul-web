import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';

type TranslationEntityLabelKey =
  | 'post'
  | 'series'
  | 'page'
  | 'work'
  | 'menu'
  | 'artist'
  | 'label'
  | 'release'
  | 'emailTemplate'
  | 'emailLayout'
  | 'campaign'
  | 'form'
  | 'programEvent'
  | 'privacy'
  | 'terms'
  | 'unknown';

type CommonTranslationEntityLabelKey =
  | 'post'
  | 'series'
  | 'page'
  | 'work'
  | 'menu'
  | 'artist'
  | 'label'
  | 'release'
  | 'privacy'
  | 'terms'
  | 'emailTemplate'
  | 'emailLayout'
  | 'campaign'
  | 'form'
  | 'programEvent';

export function getTranslationEntityLabelKey(
  entityType: TranslationEntityType | null | undefined,
): TranslationEntityLabelKey {
  switch (entityType ?? TranslationEntityType.UNSPECIFIED) {
    case TranslationEntityType.POST:
      return 'post';
    case TranslationEntityType.POST_SERIES:
      return 'series';
    case TranslationEntityType.PAGE:
      return 'page';
    case TranslationEntityType.WORK:
      return 'work';
    case TranslationEntityType.MENU:
      return 'menu';
    case TranslationEntityType.ARTIST:
      return 'artist';
    case TranslationEntityType.LABEL:
      return 'label';
    case TranslationEntityType.RELEASE:
      return 'release';
    case TranslationEntityType.EMAIL_TEMPLATE:
      return 'emailTemplate';
    case TranslationEntityType.EMAIL_LAYOUT:
      return 'emailLayout';
    case TranslationEntityType.CAMPAIGN:
      return 'campaign';
    case TranslationEntityType.FORM:
      return 'form';
    case TranslationEntityType.PROGRAM_EVENT:
      return 'programEvent';
    case TranslationEntityType.PRIVACY:
      return 'privacy';
    case TranslationEntityType.TERMS:
      return 'terms';
    default:
      return 'unknown';
  }
}

export function getCommonTranslationEntityLabelKey(
  entityType: TranslationEntityType | null | undefined,
): CommonTranslationEntityLabelKey | null {
  const key = getTranslationEntityLabelKey(entityType);

  switch (key) {
    case 'post':
    case 'series':
    case 'page':
    case 'work':
    case 'menu':
    case 'artist':
    case 'label':
    case 'release':
    case 'privacy':
    case 'terms':
    case 'emailTemplate':
    case 'emailLayout':
    case 'campaign':
    case 'form':
    case 'programEvent':
      return key;
    default:
      return null;
  }
}

export function getTranslationEntityHref(target: TranslationEntityTargetLike | null | undefined): string | null {
  if (!target?.entityId) {
    return null;
  }

  switch (target.entityType ?? TranslationEntityType.UNSPECIFIED) {
    case TranslationEntityType.POST:
      return `/posts/${target.entityId}?edit=true`;
    case TranslationEntityType.POST_SERIES:
      return `/admin/series/${target.entityId}`;
    case TranslationEntityType.PAGE:
      return `/${target.entityId}?edit=true`;
    case TranslationEntityType.WORK:
      return `/works/${target.entityId}?edit=true`;
    case TranslationEntityType.MENU:
      return '/admin/menus';
    case TranslationEntityType.EMAIL_TEMPLATE:
      return `/admin/email-templates/${target.entityId}`;
    case TranslationEntityType.EMAIL_LAYOUT:
      return `/admin/email-layouts/${target.entityId}`;
    case TranslationEntityType.CAMPAIGN:
      return `/admin/campaigns/${target.entityId}`;
    case TranslationEntityType.ARTIST:
      return `/artists/${target.entityId}?edit=true`;
    case TranslationEntityType.LABEL:
      return `/labels/${target.entityId}?edit=true`;
    case TranslationEntityType.RELEASE:
      return `/releases/${target.entityId}?edit=true`;
    case TranslationEntityType.PRIVACY:
      return `/admin/privacy/${target.entityId}`;
    case TranslationEntityType.FORM:
      return `/admin/forms/${target.entityId}`;
    case TranslationEntityType.PROGRAM_EVENT:
      return `/events/${target.entityId}?edit=true`;
    case TranslationEntityType.TERMS:
      return `/admin/terms/${target.entityId}`;
    default:
      return null;
  }
}
type TranslationEntityTargetLike = {
  entityType?: TranslationEntityType | null;
  entityId?: string | null;
};
