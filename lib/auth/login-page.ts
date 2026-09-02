export function buildLoginRedirectHref(redirectPath: string): string {
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}
