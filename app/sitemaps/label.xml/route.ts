import { SitemapDocumentKind } from '@echovisionlab/geul-proto/public/sitemap_pb.ts';
import { buildSitemapRouteResponse } from '../route-shared';

export async function GET() {
  return buildSitemapRouteResponse(SitemapDocumentKind.LABEL);
}
