const OPEN_API_PATH_PREFIX = 'api.open.v1.';

export function isOpenApiPath(path: string): boolean {
  return path.startsWith(OPEN_API_PATH_PREFIX);
}

export function shouldRetryOpenApiWithoutSession(status: number, path: string): boolean {
  return status === 401 && isOpenApiPath(path);
}

export function shouldExpireSessionCookies(status: number): boolean {
  return status === 401;
}

export function shouldRetryWithNextTarget(status: number, path: string): boolean {
  if (status >= 500) {
    return true;
  }

  if (!isOpenApiPath(path)) {
    return false;
  }

  // Open APIs are auth-optional; if the first upstream enforces auth, try the public upstream.
  return status === 401 || status === 403 || status === 404;
}
