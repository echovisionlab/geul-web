import { getPostPermissionRevokedDestination } from '@/lib/queries/post-browser';

export type ResolvePostRevokedDestination = (postId: string) => Promise<string>;
export type NavigateToDestination = (destination: string) => void;

export async function navigateAfterPostPermissionRevoked(
  postId: string,
  resolveDestination: ResolvePostRevokedDestination = getPostPermissionRevokedDestination,
  navigate: NavigateToDestination = (destination) => window.location.assign(destination),
): Promise<boolean> {
  let destination = '/';
  try {
    destination = (await resolveDestination(postId)) || '/';
  } catch {
    destination = '/';
  }

  try {
    navigate(destination);
    return true;
  } catch {
    if (destination !== '/') {
      try {
        navigate('/');
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}
