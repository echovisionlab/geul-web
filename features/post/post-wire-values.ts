import type { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import type { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';

// Wire values of the post enums used by the public post view. Importing the generated enums would also
// load `post_pb`'s descriptor, its dependencies and the protobuf registry on every post page.
// `post-wire-values.test.ts` asserts these equal the generated enums.

/** `api.open.v1.PostStatus` */
export const PUBLIC_POST_STATUS = {
  UNSPECIFIED: 0 as PublicPostStatus.UNSPECIFIED,
  DRAFT: 1 as PublicPostStatus.DRAFT,
  PUBLISHED: 2 as PublicPostStatus.PUBLISHED,
  ARCHIVED: 3 as PublicPostStatus.ARCHIVED,
  SCHEDULED: 4 as PublicPostStatus.SCHEDULED,
} as const;

/** `api.manage.v1.PostAction` */
export const POST_ACTION = {
  UNSPECIFIED: 0 as PostAction.UNSPECIFIED,
  EDIT: 1 as PostAction.EDIT,
  PUBLISH_NOW: 2 as PostAction.PUBLISH_NOW,
  SCHEDULE: 3 as PostAction.SCHEDULE,
  CANCEL_SCHEDULE: 4 as PostAction.CANCEL_SCHEDULE,
  UNPUBLISH: 5 as PostAction.UNPUBLISH,
  ARCHIVE: 6 as PostAction.ARCHIVE,
  REPUBLISH: 7 as PostAction.REPUBLISH,
  DELETE: 8 as PostAction.DELETE,
  ADD_AUTHOR: 9 as PostAction.ADD_AUTHOR,
  REMOVE_AUTHOR: 10 as PostAction.REMOVE_AUTHOR,
  MANAGE_COLLABORATORS: 11 as PostAction.MANAGE_COLLABORATORS,
  VIEW_VERSIONS: 12 as PostAction.VIEW_VERSIONS,
  RESTORE_VERSION: 13 as PostAction.RESTORE_VERSION,
  MANAGE_SHARE_LINKS: 14 as PostAction.MANAGE_SHARE_LINKS,
  MODERATE_COMMENTS: 15 as PostAction.MODERATE_COMMENTS,
} as const;
