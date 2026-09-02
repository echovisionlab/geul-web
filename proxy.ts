import { NextResponse, type NextRequest } from 'next/server';
import { createPublicRequestCorrelation, REQUEST_ID_HEADER } from '@/lib/observability/request-correlation';

function shouldBypassProxy(pathname: string): boolean {
  if (pathname === '/api/health') {
    return true;
  }

  if (pathname.startsWith('/.well-known')) {
    return true;
  }

  if (pathname.startsWith('/api/rpc/')) {
    return false;
  }

  const lastSegment = pathname.split('/').pop() ?? '';
  return /\.[a-z0-9]+$/i.test(lastSegment);
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Skip proxy header injection for static/metadata/well-known paths.
  if (shouldBypassProxy(pathname)) {
    return NextResponse.next();
  }

  const requestHeaders = new Headers(request.headers);
  const { requestId } = createPublicRequestCorrelation();
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  requestHeaders.set('x-pathname', pathname);
  requestHeaders.set('x-search', search);
  requestHeaders.set('x-path-with-search', `${pathname}${search}`);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);

  if (pathname === '/my' || pathname.startsWith('/my/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
