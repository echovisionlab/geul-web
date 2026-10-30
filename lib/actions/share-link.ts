'use server';
import { queryResult, type QueryResult } from '@/lib/api/query-result';

import type { ActionResult } from '@/lib/actions/action-result';
import { runAction } from '@/lib/actions/run-action';
import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import { Code } from '@connectrpc/connect';
import { ShareLinkEntityType, type ShareLinkItem } from '@echovisionlab/geul-proto/secure/share_link_pb.ts';
import { createShareLinkClient } from '@/lib/api/server-client';
import { env } from '@/lib/env';
import { createLogger } from '@/lib/utils/logger';

const logger = createLogger('share-link-actions');

function toAbsoluteShareUrl(rawUrl: string): string {
  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl;
  }

  if (rawUrl.startsWith('//')) {
    return `https:${rawUrl}`;
  }

  const host = env.HOST.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const base = `https://${host}`;
  const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
  return new URL(path, base).toString();
}

function prependHost(link: ShareLinkItem): ShareLinkItem {
  link.url = toAbsoluteShareUrl(link.url);
  return link;
}

export async function listShareLinksAction(
  entityType: ShareLinkEntityType,
  entityId: string,
): Promise<QueryResult<ShareLinkItem[]>> {
  return queryResult(async () => {
    try {
      const client = await createShareLinkClient();
      const response = await client.listShareLinks({ entityType, entityId });
      return response.shareLinks.map(prependHost);
    } catch (err) {
      logger.error('Failed to list share links', { error: err });
      throw err;
    }
  });
}

export async function createShareLinkAction(
  entityType: ShareLinkEntityType,
  entityId: string,
  options?: {
    label?: string;
    expiresAt?: Date;
    password?: string;
  },
): Promise<ActionResult<{ shareLink: ShareLinkItem }>> {
  return runAction(
    'share-link-actions',
    'createShareLinkAction',
    async () => {
      const client = await createShareLinkClient();
      const response = await client.createShareLink({
        entityType,
        entityId,
        label: options?.label,
        expiresAt: options?.expiresAt ? timestampFromDate(options.expiresAt) : undefined,
        password: options?.password,
      });
      if (!response.shareLink) {
        throw new Error('Failed to create share link');
      }
      return { shareLink: prependHost(response.shareLink) };
    },
    {
      fallback: 'Failed to create share link',
      code: 'SHARE_LINK_CREATE_FAILED',
      messages: {
        [Code.NotFound]: 'Entity not found',
        [Code.PermissionDenied]: 'No permission to create share link',
      },
      privateValues: [options?.password],
    },
  );
}

export async function deleteShareLinkAction(id: string): Promise<ActionResult<{ success: true }>> {
  return runAction(
    'share-link-actions',
    'deleteShareLinkAction',
    async () => {
      const client = await createShareLinkClient();
      const response = await client.deleteShareLink({ id });
      if (!response.success) {
        throw new Error('Failed to delete share link');
      }
      return { success: true as const };
    },
    {
      fallback: 'Failed to delete share link',
      code: 'SHARE_LINK_DELETE_FAILED',
      messages: {
        [Code.NotFound]: 'Share link not found',
        [Code.PermissionDenied]: 'No permission to delete share link',
      },
    },
  );
}
