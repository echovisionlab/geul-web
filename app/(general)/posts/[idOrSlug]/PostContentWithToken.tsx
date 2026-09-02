import { PostAction } from '@echovisionlab/geul-proto/secure/post_pb.ts';
import { DraftModeAlert } from '@/features/draft-mode/DraftModeAlert';
import { getPostAllowedActions, getPostViewWithToken } from '@/lib/queries/post';
import { PostViewContent } from '@/features/post/PostViewContent';
import { toPostViewModel } from '@/features/post/post-view-model';

interface Props {
  idOrSlug: string;
  token: string;
  initialPost: NonNullable<Awaited<ReturnType<typeof getPostViewWithToken>>>;
  requestedLocale: string;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Async component that continues from the route's token-verified typed Block document.
 */
export async function PostContentWithToken({ initialPost, requestedLocale, query }: Props) {
  const post = initialPost;

  const transformedPost = toPostViewModel(post);
  const allowedActions = await getPostAllowedActions(post.id);
  transformedPost.canEdit = allowedActions.includes(PostAction.EDIT);
  const pathname = `/posts/${post.slug || post.id}`;
  return (
    <>
      <DraftModeAlert id={post.id} status={post.status} />
      <PostViewContent
        post={transformedPost}
        pathname={pathname}
        query={query}
        requestedLocale={requestedLocale}
        allowedActions={allowedActions}
      />
    </>
  );
}
