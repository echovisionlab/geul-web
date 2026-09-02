'use server';

import { getPostAllowedActions, getPostViewWithToken } from '@/lib/queries/post';

export type PostShareAccessState = {
  post?: NonNullable<Awaited<ReturnType<typeof getPostViewWithToken>>>;
  allowedActions?: Awaited<ReturnType<typeof getPostAllowedActions>>;
  requestedLocale?: string;
  error?: 'incorrect_password' | 'not_found';
};

export async function accessPostShareAction(
  _previousState: PostShareAccessState,
  formData: FormData,
): Promise<PostShareAccessState> {
  const token = String(formData.get('token') ?? '').trim();
  const idOrSlug = String(formData.get('idOrSlug') ?? '').trim();
  const requestedLocale = String(formData.get('requestedLocale') ?? '').trim() || undefined;
  const password = String(formData.get('password') ?? '');
  if (!token || !idOrSlug || !password) {
    return { error: 'incorrect_password' };
  }

  try {
    const post = await getPostViewWithToken(idOrSlug, token, requestedLocale, password);
    if (!post) {
      return { error: 'not_found' };
    }
    return {
      post,
      allowedActions: await getPostAllowedActions(post.id).catch(() => []),
      requestedLocale,
    };
  } catch {
    return { error: 'incorrect_password' };
  }
}
