import { PostStatus as PublicPostStatus } from '@echovisionlab/geul-proto/public/post_pb.ts';
import { PostStatus } from '@echovisionlab/geul-proto/secure/post_pb.ts';

export type PostStatusValue = 'draft' | 'scheduled' | 'published' | 'archived';

export function postStatusToString(status: PostStatus): PostStatusValue {
  switch (status) {
    case PostStatus.PUBLISHED:
      return 'published';
    case PostStatus.ARCHIVED:
      return 'archived';
    case PostStatus.SCHEDULED:
      return 'scheduled';
    default:
      return 'draft';
  }
}

export function stringToPostStatus(status?: string): PostStatus | undefined {
  switch (status) {
    case 'draft':
      return PostStatus.DRAFT;
    case 'published':
      return PostStatus.PUBLISHED;
    case 'archived':
      return PostStatus.ARCHIVED;
    case 'scheduled':
      return PostStatus.SCHEDULED;
    default:
      return undefined;
  }
}

export function publicPostStatusToString(status: PublicPostStatus): PostStatusValue {
  switch (status) {
    case PublicPostStatus.PUBLISHED:
      return 'published';
    case PublicPostStatus.ARCHIVED:
      return 'archived';
    case PublicPostStatus.SCHEDULED:
      return 'scheduled';
    default:
      return 'draft';
  }
}
