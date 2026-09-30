import type { Code } from '@connectrpc/connect';

export const LOCAL_ACTION_ERROR_CODES = [
  'ACTION_INVALID_LOCALE',
  'ENTITY_ID_REQUIRED',
  'FORM_CREATE_FAILED',
  'FORM_DELETE_FAILED',
  'FORM_DELETE_SUBMISSION_FAILED',
  'FORM_REMOVE_FEATURED_IMAGE_FAILED',
  'FORM_SET_FEATURED_IMAGE_FAILED',
  'FORM_SUBMIT_FAILED',
  'FORM_UPDATE_FAILED',
  'LIST_SUBMISSIONS_FAILED',
  'LOCALE_NOT_ALLOWED',
  'LOCALE_REQUIRED',
  'OG_GENERATION_LOAD_FAILED',
  'OG_GENERATION_NOT_FOUND',
  'OG_GENERATION_RUN_LOAD_FAILED',
  'OG_GENERATION_RUN_NOT_FOUND',
  'OG_LATEST_GENERATION_LOAD_FAILED',
  'OG_REGENERATE_FAILED',
  'PAGE_CREATE_FAILED',
  'PAGE_DELETE_FAILED',
  'PAGE_PUBLISH_FAILED',
  'PAGE_REMOVE_FEATURED_IMAGE_FAILED',
  'PAGE_SET_FEATURED_IMAGE_FAILED',
  'PAGE_UNPUBLISH_FAILED',
  'PAGE_UPDATE_SHOW_TITLE_FAILED',
  'PAGE_UPDATE_SLUG_FAILED',
  'POST_ADD_AUTHOR_FAILED',
  'POST_ADD_COLLABORATOR_FAILED',
  'POST_ARCHIVE_FAILED',
  'POST_CANCEL_SCHEDULE_FAILED',
  'POST_CREATE_FAILED',
  'POST_DELETE_FAILED',
  'POST_EXPORT_MARKDOWN_FAILED',
  'POST_GET_MARKDOWN_FAILED',
  'POST_PUBLISH_FAILED',
  'POST_REMOVE_AUTHOR_FAILED',
  'POST_REMOVE_COLLABORATOR_FAILED',
  'POST_REMOVE_FEATURED_IMAGE_FAILED',
  'POST_REPUBLISH_FAILED',
  'POST_SCHEDULE_FAILED',
  'POST_SET_FEATURED_IMAGE_FAILED',
  'POST_UNPUBLISH_FAILED',
  'POST_UPDATE_FAILED',
  'RELEASE_CREATE_FAILED',
  'RELEASE_DELETE_ARTWORK_FAILED',
  'RELEASE_DELETE_FAILED',
  'RELEASE_PUBLISH_FAILED',
  'RELEASE_SET_ARTWORK_FAILED',
  'RELEASE_UNPUBLISH_FAILED',
  'RELEASE_UPDATE_ARTISTS_FAILED',
  'RELEASE_UPDATE_CATEGORIES_FAILED',
  'RELEASE_UPDATE_CREDITS_FAILED',
  'RELEASE_UPDATE_FIELDS_FAILED',
  'RELEASE_UPDATE_FORMATS_FAILED',
  'RELEASE_UPDATE_GENRES_FAILED',
  'RELEASE_UPDATE_LABELS_FAILED',
  'RELEASE_UPDATE_SLUG_FAILED',
  'RELEASE_UPDATE_STYLES_FAILED',
  'SHARE_LINK_CREATE_FAILED',
  'SHARE_LINK_DELETE_FAILED',
] as const;

export type LocalActionErrorCode = (typeof LOCAL_ACTION_ERROR_CODES)[number];
export type ActionErrorCode = Code | LocalActionErrorCode;

type ForbidFields<T extends object> = { [Key in keyof T]?: never };
type ValidActionFields<T extends object> = T & {
  [Key in Extract<keyof T, 'ok' | 'error' | 'errorCode'>]?: never;
};

export type ActionResult<TSuccessFields extends object = {}, TFailureFields extends object = {}> =
  | ({ ok: true; error?: never; errorCode?: never } & ValidActionFields<TSuccessFields> & ForbidFields<TFailureFields>)
  | ({ ok: false; error: string; errorCode: ActionErrorCode } & ValidActionFields<TFailureFields> &
      ForbidFields<TSuccessFields>);

export function actionSuccess<TSuccessFields extends object>(
  fields: ValidActionFields<TSuccessFields>,
): { ok: true } & TSuccessFields {
  return { ...fields, ok: true } as { ok: true } & TSuccessFields;
}

export function actionFailure<TFailureFields extends object = {}>(
  error: string,
  errorCode: ActionErrorCode,
  fields?: ValidActionFields<TFailureFields>,
): { ok: false; error: string; errorCode: ActionErrorCode } & TFailureFields {
  const nonEmptyError = error.trim() ? error : 'Action failed';
  return {
    ...fields,
    ok: false,
    error: nonEmptyError,
    errorCode,
  } as { ok: false; error: string; errorCode: ActionErrorCode } & TFailureFields;
}
