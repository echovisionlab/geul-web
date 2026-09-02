import { SitemapDocumentKind, SitemapDocumentStatus } from '@echovisionlab/geul-proto/public/sitemap_pb.ts';
import { getSitemapDocument } from '@/lib/queries/sitemap';

export async function GET() {
  const document = await getSitemapDocument(SitemapDocumentKind.INDEX);
  const headers = new Headers({
    'Content-Type': document.contentType,
    'Cache-Control': 'no-store',
  });

  if (document.retryAfterSeconds) {
    headers.set('Retry-After', String(document.retryAfterSeconds));
  }

  const status = document.status === SitemapDocumentStatus.UNAVAILABLE ? 503 : 200;

  return new Response(document.content, {
    status,
    headers,
  });
}
