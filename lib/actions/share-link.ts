'use server';

import { isConnectErrorCode } from '@/lib/api/connect-error';
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
): Promise<ShareLinkItem[]> {
  try {
    const client = await createShareLinkClient();
    const response = await client.listShareLinks({ entityType, entityId });
    return response.shareLinks.map(prependHost);
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return [];
    }
    logger.error('Failed to list share links', { error: err });
    return [];
  }
}

export async function createShareLinkAction(
  entityType: ShareLinkEntityType,
  entityId: string,
  options?: {
    label?: string;
    expiresAt?: Date;
    password?: string;
  },
): Promise<{ shareLink?: ShareLinkItem; error?: string }> {
  try {
    const client = await createShareLinkClient();
    const response = await client.createShareLink({
      entityType,
      entityId,
      label: options?.label,
      expiresAt: options?.expiresAt ? timestampFromDate(options.expiresAt) : undefined,
      password: options?.password,
    });
    if (!response.shareLink) {
      return { error: 'Failed to create share link' };
    }
    return { shareLink: prependHost(response.shareLink) };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Entity not found' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to create share link' };
    }
    logger.error('Failed to create share link', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to create share link' };
  }
}

export async function deleteShareLinkAction(id: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const client = await createShareLinkClient();
    const response = await client.deleteShareLink({ id });
    return response.success ? { success: true } : { error: 'Failed to delete share link' };
  } catch (err) {
    if (isConnectErrorCode(err, Code.Unauthenticated)) {
      return { error: 'Unauthorized' };
    }
    if (isConnectErrorCode(err, Code.NotFound)) {
      return { error: 'Share link not found' };
    }
    if (isConnectErrorCode(err, Code.PermissionDenied)) {
      return { error: 'No permission to delete share link' };
    }
    logger.error('Failed to delete share link', { error: err });
    return { error: err instanceof Error ? err.message : 'Failed to delete share link' };
  }
}
