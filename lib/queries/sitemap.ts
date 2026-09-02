import { isConnectError } from '@/lib/api/connect-error';
import { SitemapDocumentKind, SitemapDocumentStatus } from '@echovisionlab/geul-proto/public/sitemap_pb.ts';
import { createPublicSitemapClient } from '@/lib/api/server-client';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('sitemap-queries');

export interface SitemapDocumentResult {
  status: SitemapDocumentStatus;
  content: string;
  contentType: string;
  retryAfterSeconds: number | null;
}

export async function getSitemapDocument(kind: SitemapDocumentKind): Promise<SitemapDocumentResult> {
  try {
    const client = createPublicSitemapClient();
    const response = await client.getDocument({ kind });

    return {
      status: response.status,
      content: response.content,
      contentType: response.contentType || 'text/plain; charset=utf-8',
      retryAfterSeconds: response.retryAfterSeconds ?? null,
    };
  } catch (err) {
    if (isConnectError(err)) {
      logger.error('GetSitemapDocument RPC error', { error: err.message });
    } else {
      logger.error('GetSitemapDocument error', { error: err });
    }

    return {
      status: SitemapDocumentStatus.UNAVAILABLE,
      content: 'Sitemap unavailable.\n',
      contentType: 'text/plain; charset=utf-8',
      retryAfterSeconds: 300,
    };
  }
}
