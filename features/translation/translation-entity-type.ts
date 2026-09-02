import { TranslationEntityType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import type { TranslationEntityTypeKey } from '@/lib/translation/lifecycle';

const PROTO_ENTITY_TYPE = {
  page: TranslationEntityType.PAGE,
  post: TranslationEntityType.POST,
  post_series: TranslationEntityType.POST_SERIES,
  work: TranslationEntityType.WORK,
  program_event: TranslationEntityType.PROGRAM_EVENT,
  artist: TranslationEntityType.ARTIST,
  label: TranslationEntityType.LABEL,
  release: TranslationEntityType.RELEASE,
  menu: TranslationEntityType.MENU,
  email_template: TranslationEntityType.EMAIL_TEMPLATE,
  email_layout: TranslationEntityType.EMAIL_LAYOUT,
  privacy: TranslationEntityType.PRIVACY,
  terms: TranslationEntityType.TERMS,
  campaign: TranslationEntityType.CAMPAIGN,
  form: TranslationEntityType.FORM,
} satisfies Record<TranslationEntityTypeKey, TranslationEntityType>;

export function getProtoTranslationEntityType(entityType: TranslationEntityTypeKey): TranslationEntityType {
  return PROTO_ENTITY_TYPE[entityType];
}
